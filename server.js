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

    twimlResponse.say('Connecting you to the creator...');
    const dial = twimlResponse.dial({
      callerId: process.env.TWILIO_NUMBER,
      timeout: 60,
      record: 'do-not-record'
    });
    dial.client('C');

    return res.type('text/xml').send(twimlResponse.toString());

  } catch (err) {
    console.error('Error in /incoming-call:', err);
    twimlResponse.say('System error.');
    twimlResponse.hangup();
    return res.type('text/xml').send(twimlResponse.toString());
  }
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

// === НОВЫЙ РОУТ ===
app.post('/start-call', async (req, res) => {
  const { callSid, caller, pricePerInterval = 3 } = req.body;
  const intervalMs = 30 * 1000; // 30 секунд

  // Проверяем баланс
  const balance = await getUserCredits(caller);
  if (balance < pricePerInterval) {
    return res.status(402).json({ error: 'Недостаточно кредитов' });
  }

  // Запускаем таймер списания
  const intervalId = setInterval(async () => {
    const balance = await getUserCredits('+14482360473');
    if (balance >= pricePerInterval) {
      await chargeUser('+14482360473', pricePerInterval);
      console.log(`Списано ${pricePerInterval} кредитов у ${caller}`);
    } else {
      console.log(`Недостаточно кредитов у ${'+14482360473'}. Завершаем звонок.`);
      clearInterval(intervalId);
      activeIntervals.delete(callSid);
      // Завершить звонок (необязательно)
    }
  }, intervalMs);

  activeIntervals.set(callSid, intervalId);
  res.json({ success: true });
});

// === ЗАВЕРШЕНИЕ ЗВОНКА ===
app.post('/end-call', (req, res) => {
  const { callSid } = req.body;
  if (activeIntervals.has(callSid)) {
    clearInterval(activeIntervals.get(callSid));
    activeIntervals.delete(callSid);
    console.log(`Звонок ${callSid} завершён, таймер остановлен.`);
  }
  res.sendStatus(200);
});

// === Запуск сервера ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server запущен на http://localhost:${PORT}`);
});
