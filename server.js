require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { twiml } = require('twilio');
const twilio = require('twilio');
const cors = require('cors');
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const activeIntervals = new Map();
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
app.post('/incoming-call', async (req, res) => {
  const from = req.body.From; // Номер пользователя A
  const calledNumber = req.body.To; // Номер Twilio, на который позвонили
  const parentCallSid = req.body.CallSid; // Уникальный ID звонка от A к Twilio
  const twimlResponse = new twiml.VoiceResponse();
  try {
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
    })
      .client({
        statusCallback: 'https://burndial-twilio-cron.onrender.com/call-status',
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
app.post('/call-status', async(req, res) => {
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
  switch (callStatus) {
    case 'initiated':
      console.log('Call initiated - ringing started');
      // Call initiated
      break;
    case 'answered':
        console.log('Call answered by client C!');

  // Получаем номер клиента A из параметров запроса
  const caller = req.query.caller;
  if (!caller) {
    console.log('Caller number not provided in query params');
    break;
  }

  // Проверяем баланс клиента A
  try {
    const {  data:user, error: userErr } = await supabase
      .from('customer_balances')
      .select('id, balance')
      .eq('phone_number', caller)
      .single();

    if (userErr || !user) {
      console.log(`[BALANCE CHECK] User not found for caller: ${caller}`, userErr);
      // Можно повесить трубку, если пользователь не найден
      // Но обычно это уже проверяется в /incoming-call
    } else {
      const balance = Number(user.balance);
      console.log(`[BALANCE CHECK] Caller ${caller} has balance: ${balance}`);
      
      // Можно добавить логику оповещения о балансе или проверки минимального баланса
      if (balance < 1) { // минимальный порог
        console.log(`[BALANCE CHECK] Warning: Caller ${caller} has very low balance: ${balance}`);
        // Здесь можно отправить уведомление пользователю о низком балансе
      }
    }
  } catch (error) {
    console.error('[BALANCE CHECK] Error checking balance:', error);
  }

  // Это место, где можно начать таймер для периодического списания
  const callSid = req.body.CallSid;
  const pricePerMinute = Number(req.query.price) || 3;

  // Здесь можно запустить интервал для списания каждые 60 секунд (или 5 секунд для теста)
  if (!activeIntervals.has(callSid)) {
    const intervalId = setInterval(async () => {
      console.log(`[Billing Tick] Charging ${pricePerMinute} credits for call ${callSid}`);
      
      // Списание средств за прошедшее время
      const charged = await chargeUser(caller, pricePerMinute);
      if (!charged) {
        console.log(`[Billing] Failed to charge user ${caller}, hanging up call`);
        // Здесь можно повесить трубку через Twilio API
        try {
          await client.calls(callSid).update({ status: 'completed' });
        } catch (hangupError) {
          console.error('Error hanging up call:', hangupError);
        }
      }
    }, 60000); // 60 секунд для реального биллинга, 5000 для теста

    activeIntervals.set(callSid, intervalId);
  }
      break;
    case 'ringing':
      console.log('Call is ringing - waiting for answer');
      // Call is ringing
      break;
    case 'in-progress':
      console.log('Call answered by client C!');
      // This is when the WebRTC client answers the call
      // You can trigger notifications, update database, etc.
      const intervalId = setInterval(async () => {
        console.log(`[Call Active Tick] Call ${callSid} is live. This is where periodic billing would occur.`);
      }, 5000); // 5 seconds interval
      
      activeIntervals.set(callSid, intervalId);
      break;
    case 'completed':
      // Call ended
      console.log('Call completed');
      // Stop the interval when call ends
      if (activeIntervals.has(callSid)) {
        clearInterval(activeIntervals.get(callSid));
        activeIntervals.delete(callSid);
        console.log(`[Timer] Call ${callSid} ended. Logging timer stopped.`);
      }
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
  // Событие: клиент C поднял трубку (статус 'in-progress' соответствует 'answered')
  if (CallStatus === 'in-progress') {
    console.log(`[Timer] Call ${CallSid} connected. Starting 5-second interval log.`);
    
   

    const intervalId = setInterval(async () => {
     
      console.log(`[Call Active Tick] Call ${CallSid} is live. This is where periodic billing would occur.`);
      
      
    }, 5000); // ИЗМЕНЕНО: интервал установлен на 5 секунд

    activeIntervals.set(CallSid, intervalId);
  }
  // Событие: звонок завершен (любой стороной)
  if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'no-answer' || CallStatus === 'canceled') {
    if (activeIntervals.has(CallSid)) {
      clearInterval(activeIntervals.get(CallSid));
      activeIntervals.delete(CallSid);
      console.log(`[Timer] Call ${CallSid} ended. Logging timer stopped.`);
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`:rocket: Server running on http://localhost:${PORT}`);
});
