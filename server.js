require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { twiml } = require('twilio');
const twilio = require('twilio');
const cors = require('cors');
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
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Хранилище для активных таймеров списания
// Ключ - CallSid, Значение - intervalId
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
  const from = req.body.From; // Номер пользователя A
  const calledNumber = req.body.To; // Номер Twilio, на который позвонили
  const parentCallSid = req.body.CallSid; // Уникальный ID звонка от A к Twilio

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

    const pricePerMinute = serviceNumber.price_per_minute || 3;

    // 2. Найти создателя (опционально, если не используется далее)
    
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
    if (balance < pricePerMinute) {
      twimlResponse.say('You have insufficient funds to make this call.');
      twimlResponse.hangup();
      return res.type('text/xml').send(twimlResponse.toString());
    }

    // :white_check_mark: Соединяем A с клиентом C, используя statusCallback
    console.log(`[ProxyCall] A=${from} → client:C. Setting up status callback.`);
    
    twimlResponse.say('Connecting you to the creator...');
    
    // Формируем URL для коллбэка, передавая нужные данные
    const callbackUrl = `https://burndial-twilio-cron.onrender.com/call-status-handler?caller=${encodeURIComponent(from)}&price=${pricePerMinute}`;

    const dial = twimlResponse.dial({
      callerId: process.env.TWILIO_NUMBER,
      timeout: 60,
      // :white_check_mark: Вот магия:
      statusCallback: callbackUrl,
      statusCallbackMethod: 'POST',
      // statusCallbackEvent: 'answered com?pleted', // Уведомлять, когда ответили и когда завершили
    })
   .client({
    statusCallback: 'https://burndial-twilio-cron.onrender.com/call-status',
    statusCallbackMethod: 'POST',
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
  }, 'C'); 

    return res.type('text/xml').send(twimlResponse.toString());

  } catch (err) {
    console.error('Error in /incoming-call:', err);
    twimlResponse.say('A system error occurred.');
    twimlResponse.hangup();
    return res.type('text/xml').send(twimlResponse.toString());
  }
});

app.post('/call-status', (req, res) => {
  const callStatus = req.body.CallStatus; // 'initiated', 'ringing', 'in-progress', 'completed'
  const callSid = req.body.CallSid;
  const from = req.body.From;
  const to = req.body.To;
  
  console.log('Call status update:', {
    callStatus,
    callSid,
    from,
    to,
    timestamp: new Date().toISOString()
  });
  
  // Handle different status events
  switch(callStatus) {
    case 'initiated':
      console.log('Call initiated - ringing started');
      // Call initiated
      break;
    case 'ringing':
      console.log('Call is ringing - waiting for answer');
      // Call is ringing
      break;
    case 'in-progress':
      console.log('Call answered by client C!');
      // This is when the WebRTC client answers the call
      // You can trigger notifications, update database, etc.
      break;
    case 'completed':
      console.log('Call completed');
      // Call ended
      break;
  }
  
  res.status(200).send('OK');
});
// === 3. НОВЫЙ ЕДИНЫЙ ОБРАБОТЧИК СТАТУСА ЗВОНКА ===
app.post('/call-status-handler', async (req, res) => {
  const { CallSid, CallStatus } = req.body;
  const { caller, price } = req.query;
  const pricePerMinute = Number(price);

  console.log(`[StatusCallback] CallSid: ${CallSid}, Status: ${CallStatus}, Caller: ${caller}`);

  // Событие: клиент C поднял трубку
  if (CallStatus === 'in-progress') {
    console.log(`[Billing] Starting billing for ${caller} on call ${CallSid}`);
    
    // Сразу списываем за первую минуту
    const charged = await chargeUser(caller, pricePerMinute);
    if (!charged) {
      console.log(`[Billing] Initial charge failed for ${caller}. Terminating call.`);
      client.calls(CallSid).update({ status: 'completed' });
      return res.sendStatus(200);
    }
    
    // Запускаем таймер списания каждую минуту (60000 мс)
    const intervalId = setInterval(async () => {
      console.log('HELLO ')
      const success = await chargeUser(caller, pricePerMinute);
      if (!success) {
        console.log(`[Billing] Insufficient funds for ${caller}. Terminating call ${CallSid}.`);
        // Останавливаем таймер
        clearInterval(intervalId);
        activeIntervals.delete(CallSid);
        // Принудительно завершаем звонок через REST API
        await client.calls(CallSid).update({ status: 'completed' });
      } else {
        console.log(`[Billing] Charged ${pricePerMinute} from ${caller} for call ${CallSid}.`);
      }
    }, 10 * 1000); // 60 секунд

    activeIntervals.set(CallSid, intervalId);
  }

  // Событие: звонок завершен (любой стороной)
  if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'no-answer' || CallStatus === 'canceled') {
    if (activeIntervals.has(CallSid)) {
      clearInterval(activeIntervals.get(CallSid));
      activeIntervals.delete(CallSid);
      console.log(`[Billing] Call ${CallSid} ended. Billing timer stopped.`);
    }
  }

  res.sendStatus(200);
});


// === Вспомогательные функции (без изменений) ===
async function chargeUser(phone, amount = 3) {
  const { data: user, error: userErr } = await supabase
    .from('customer_balances')
    .select('id, balance')
    .eq('phone_number', phone)
    .single();

  if (userErr || !user) {
    console.error('[SUPABASE] User not found for charging', userErr);
    return false;
  }
  if (Number(user.balance) < amount) {
    console.log(`[CREDITS] Not enough balance for ${phone}. Has ${user.balance}, needs ${amount}`);
    return false;
  }
  const newBalance = Number(user.balance) - amount;

  const { error } = await supabase
    .from('customer_balances')
    .update({ balance: newBalance })
    .eq('id', user.id);

  if (error) {
    console.error('[SUPABASE] Failed to update balance', error);
    return false;
  }

  console.log(`[CREDITS] Charged ${amount} from ${phone}, new balance is ${newBalance}`);
  return true;
}


// === Запуск сервера ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`:rocket: Server running on http://localhost:${PORT}`);
});
