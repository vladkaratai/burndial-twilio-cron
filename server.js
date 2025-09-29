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
app.use(bodyParser.json());

const activeIntervals = new Map();

// === 1. Выдача токена для Voice SDK v2 ===
app.get('/token-c', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { creator_id } = req.query;
  if (!creator_id) return res.status(400).json({ error: 'creator_id is required' });

  try {
    const token = new AccessToken(
      process.env.TWILIO_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: 'C' }
    );
    token.addGrant(new VoiceGrant({ incomingAllow: true }));
    return res.json({ token: token.toJwt() });
  } catch (err) {
    console.error('Token generation error:', err);
    return res.status(500).json({ error: 'Failed to generate token' });
  }
});

// === 2. Входящий звонок от пользователя A на номер B ===
app.post('/incoming-call', async (req, res) => {
  const from = req.body.From;
  const calledNumber = req.body.To;
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
      twimlResponse.say('Service unavailable.');
      twimlResponse.hangup();
      return res.type('text/xml').send(twimlResponse.toString());
    }

    // 2. Найти создателя
    const { data: creator, error: crErr } = await supabase
      .from('creators')
      .select('phone')
      .eq('id', serviceNumber.creator_id)
      .single();
    if (crErr || !creator) {
      twimlResponse.say('System error.');
      twimlResponse.hangup();
      return res.type('text/xml').send(twimlResponse.toString());
    }

    // 3. Проверить баланс звонящего
    const { data: user, error: userErr } = await supabase
      .from('customer_balances')
      .select('id, balance')
      .eq('phone_number', from)
      .single();
    if (userErr || !user) {
      twimlResponse.say('Account not found.');
      twimlResponse.hangup();
      return res.type('text/xml').send(twimlResponse.toString());
    }

    const balance = Number(user.balance);
    const pricePerMinute = serviceNumber.price_per_minute || 3;
    if (balance < pricePerMinute) {
      twimlResponse.say('No more credits.');
      twimlResponse.hangup();
      return res.type('text/xml').send(twimlResponse.toString());
    }

    // ✅ Соединяем A с клиентом C напрямую через <Dial>
    console.log(`[ProxyCall] A=${from} → client:C`);

    const twimlResponse = new twiml.VoiceResponse();
twimlResponse.say('Connecting you to the creator...');
const dial = twimlResponse.dial({ callerId: process.env.TWILIO_NUMBER, action: '/post-call', method: 'POST', timeout: 0 });
dial.client('C'); // Identity вашего клиента C


    return res.type('text/xml').send(twimlResponse.toString());

  } catch (err) {
    console.error('Error in /incoming-call:', err);
    twimlResponse.say('System error.');
    twimlResponse.hangup();
    return res.type('text/xml').send(twimlResponse.toString());
  }
});
app.post('/post-call', (req, res) => {
  console.log('Call ended', req.body);
  res.sendStatus(200);
});
// === 3. Статус звонка для поминутного списания ===
app.post('/call-status', async (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const caller = req.body.From; // номер звонящего
  const pricePerInterval = 3; // 3 кредита за 30 секунд
  const intervalMs = 30 * 1000; // 30 секунд

  console.log(`[CALL-STATUS] CallSid=${callSid}, Status=${callStatus}, Caller=${caller}`);

  if (callStatus === 'answered' || callStatus === 'in-progress') {
    // Снимаем сразу первый платёж
    const initialCharge = await chargeUser(caller, pricePerInterval);
    if (!initialCharge) {
      console.log(`[CALL] У ${caller} нет кредитов. Завершаем звонок ${callSid}`);
      try { await client.calls(callSid).update({ status: 'completed' }); } catch(e){ console.warn(e.message); }
      return res.sendStatus(200);
    }

    // Таймер списания каждые 30 секунд
    const intervalId = setInterval(async () => {
      const credits = await getUserCredits(caller);
      if (credits >= pricePerInterval) {
        await chargeUser(caller, pricePerInterval);
      } else {
        console.log(`[CALL] У ${caller} кончились кредиты. Завершаем звонок ${callSid}`);
        try { await client.calls(callSid).update({ status: 'completed' }); } catch(e){ console.warn(e.message); }
        clearInterval(intervalId);
        activeIntervals.delete(callSid);
      }
    }, intervalMs);

    activeIntervals.set(callSid, intervalId);
  }

  // Завершение звонка
  if (['completed', 'busy', 'no-answer', 'failed'].includes(callStatus)) {
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
  if (Number(user.balance) < price) return false;
  const newBalance = Number(user.balance) - price;

  // const newBalance = Math.max(0, Number(user.balance) - price);

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
