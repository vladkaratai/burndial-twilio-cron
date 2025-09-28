require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { twiml } = require('twilio');
const twilio = require('twilio');
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

// Инициализация клиента Twilio (для REST API)
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

// Supabase
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // добавляем для JSON (на всякий случай)

const activeIntervals = new Map();

// === 1. Выдача токена для Voice SDK v2 ===
app.get('/token-c', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  const { creator_id } = req.query;
  if (!creator_id) {
    return res.status(400).json({ error: 'creator_id is required' });
  }

  try {
    const token = new AccessToken(
      process.env.TWILIO_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: 'C' }
    );

    const grant = new VoiceGrant({ incomingAllow: true });
    token.addGrant(grant);

    return res.json({ token: token.toJwt() });
  } catch (err) {
    console.error('Token generation error:', err);
    return res.status(500).json({ error: 'Failed to generate token' });
  }
});

// === 2. Обработка входящего звонка от пользователя A на номер B ===
app.post('/incoming-call', async (req, res) => {
  const from = req.body.From; // A
  const calledNumber = req.body.To; // B
  const DOMAIN_NAME = process.env.DOMAIN_NAME;

  const twimlResponse = new twiml.VoiceResponse();

  try {
    // 1. Найти сервисный номер
    const { data: serviceNumber, error: snErr } = await supabase
      .from('service_numbers')
      .select('id, number, creator_id, price_per_minute')
      .eq('number', calledNumber)
      .single();

    if (snErr || !serviceNumber) {
      console.error('Service number not found', snErr);
      twimlResponse.say('Service unavailable.');
      twimlResponse.hangup();
      return res.type('text/xml').send(twimlResponse.toString());
    }

    // 2. Найти создателя (его реальный номер)
    const { data: creator, error: crErr } = await supabase
      .from('creators')
      .select('phone')
      .eq('id', serviceNumber.creator_id)
      .single();

    if (crErr || !creator) {
      console.error('Creator not found', crErr);
      twimlResponse.say('System error.');
      twimlResponse.hangup();
      return res.type('text/xml').send(twimlResponse.toString());
    }

    // 3. Проверить баланс звонящего (A)
    const { data: user, error: userErr } = await supabase
      .from('customer_balances')
      .select('id, balance')
      .eq('phone_number', from)
      .single();

    if (userErr || !user) {
      console.error('User not found', userErr);
      twimlResponse.say('Account not found.');
      twimlResponse.hangup();
      return res.type('text/xml').send(twimlResponse.toString());
    }

    const balance = Number(user.balance);
    const pricePerMinute = serviceNumber.price_per_minute || 3;

    if (balance < pricePerMinute) {
      console.log(`[Billing] Not enough credits, hangup.`);
      twimlResponse.say('No more credits.');
      twimlResponse.hangup();
      return res.type('text/xml').send(twimlResponse.toString());
    }

    // ✅ ВСЁ ОК — инициируем вызов на КЛИЕНТ "C" через REST API
    console.log(`[ProxyCall] A=${from} → client:C`);

    // Сохраняем данные для последующего списания
    const callData = {
      caller: from,
      serviceNumberId: serviceNumber.id,
      pricePerMinute
    };

    // Генерируем уникальный ID для отслеживания (можно использовать временный)
    // В реальности лучше сохранить в БД, но для MVP — передадим через StatusCallback
    const callTag = `caller_${from.replace(/\D/g, '')}_${Date.now()}`;

    await client.calls.create({
      url: `${DOMAIN_NAME}/voice-handler-for-c`,
      to: 'client:C',
      from: process.env.TWILIO_NUMBER,
      statusCallback: `${DOMAIN_NAME}/call-status?caller=${encodeURIComponent(from)}&price=${pricePerMinute}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      // Передаём метаданные через параметры (ограничено, но для MVP ок)
    });

    // Отвечаем звонящему: "ждите"
    twimlResponse.say('Connecting you to the creator. Please wait.');
    // twimlResponse.pause({ length: 45 }); // даём время на подключение
    twimlResponse.dial(
  { action: '/post-call', callerId: process.env.TWILIO_NUMBER },
  'client:C'
);

    return res.type('text/xml').send(twimlResponse.toString());

  } catch (err) {
    console.error('Error in /incoming-call:', err);
    twimlResponse.say('System error.');
    twimlResponse.hangup();
    return res.type('text/xml').send(twimlResponse.toString());
  }
});

// === 3. TwiML для клиента C (когда ему звонят) ===
app.post('/voice-handler-for-c', (req, res) => {
  const twimlResponse = new twiml.VoiceResponse();
  // Можно просто молчать — клиент сам управляет звонком
  // Или сказать что-то
  twimlResponse.say('You have an incoming call from a listener.');
  res.type('text/xml').send(twimlResponse.toString());
});

// === 4. Отслеживание статуса вызова на клиента C ===
app.post('/call-status', async (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const caller = req.query.caller; // передали в URL
  const pricePerMinute = parseFloat(req.query.price) || 3;

  console.log(`[CALL-STATUS] CallSid=${callSid}, Status=${callStatus}, Caller=${caller}`);

  if (callStatus === 'answered') {
    console.log(`[CALL] Разговор начался. Caller=${caller}`);
    
    // Списываем первую минуту
    await chargeUser(caller, pricePerMinute);

    // Запускаем таймер на последующие минуты
    const intervalId = setInterval(async () => {
      const credits = await getUserCredits(caller);
      if (credits >= pricePerMinute) {
        await chargeUser(caller, pricePerMinute);
      } else {
        console.log(`[CALL] У ${caller} кончились кредиты. Завершаем звонок ${callSid}`);
        try {
          await client.calls(callSid).update({ status: 'completed' });
        } catch (e) {
          console.warn('Failed to hangup call:', e.message);
        }
        clearInterval(intervalId);
        activeIntervals.delete(callSid);
      }
    }, 60 * 1000);

    activeIntervals.set(callSid, intervalId);
  }

  if (callStatus === 'completed' || callStatus === 'busy' || callStatus === 'no-answer' || callStatus === 'failed') {
    if (activeIntervals.has(callSid)) {
      clearInterval(activeIntervals.get(callSid));
      activeIntervals.delete(callSid);
      console.log(`[CALL] CallSid=${callSid} завершён. Таймер удалён.`);
    }
  }

  res.sendStatus(200);
});

// === Вспомогательные функции ===

async function getUserCredits(phone) {
  const { data, error } = await supabase
    .from('customer_balances')
    .select('balance')
    .eq('phone_number', phone)
    .single();
  return error || !data ? 0 : Number(data.balance);
}

async function chargeUser(phone, price = 3) {
  const { data: user, error: userErr } = await supabase
    .from('customer_balances')
    .select('id, balance')
    .eq('phone_number', phone)
    .single();

  if (userErr || !user) {
    console.error('[SUPABASE] User not found for charging', userErr);
    return false;
  }

  const newBalance = Math.max(0, Number(user.balance) - price);

  const { error } = await supabase
    .from('customer_balances')
    .update({ balance: newBalance })
    .eq('id', user.id);

  if (error) {
    console.error('[SUPABASE] Failed to update balance', error);
    return false;
  }

  console.log(`[CREDITS] Списано ${price} у ${phone}, остаток ${newBalance}`);
  return true;
}

// === Запуск сервера ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server запущен на http://localhost:${PORT}`);
});
