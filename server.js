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

// Активные интервалы и CallSid обеих сторон
const activeIntervals = new Map();
const activeCalls = new Map(); // key = parentCallSid, value = {a: CallSidA, c: CallSidC}

// SSE для уведомлений C (WebRTC)
const subscribers = new Set();
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  subscribers.add(res);
  req.on('close', () => subscribers.delete(res));
});

function broadcastToC(message) {
  for (const res of subscribers) {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  }
}

// Токен для клиента C
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

// Входящий звонок от A
app.post('/incoming-call', async (req, res) => {
  const from = req.body.From;
  const calledNumber = req.body.To;
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

    const pricePerMinute = Number(serviceNumber.price_per_minute) || 3;

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
      console.log(`[BLOCK CALL] Caller ${from} has only ${balance}, required ${pricePerMinute}. Call denied.`);
      twimlResponse.say('You have insufficient funds to make this call.');
      twimlResponse.hangup();
      return res.type('text/xml').send(twimlResponse.toString());
    }

    console.log(`[ProxyCall] A=${from} → client:C. Setting up status callback.`);

    const dial = twimlResponse.dial({
      callerId: process.env.TWILIO_NUMBER,
      timeout: 60,
      action: '/dial-action' // сюда придет CallSid звонка A→C
    }).client({
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

// Получение CallSid звонка A→C
app.post('/dial-action', (req, res) => {
  const parentCallSid = req.body.CallSid; // звонок A→Twilio
  const dialCallSid = req.body.DialCallSid; // звонок Twilio→C
  activeCalls.set(parentCallSid, { a: parentCallSid, c: dialCallSid });
  res.sendStatus(200);
});

// Обработка статусов звонка
app.post('/call-status-handler', async (req, res) => {
  const { CallSid, CallStatus } = req.body;
  const { caller, price } = req.query;
  const pricePerMinute = Number(price);

  console.log(`[StatusCallback] CallSid: ${CallSid}, Status: ${CallStatus}, Caller: ${caller}`);

  if (CallStatus === 'in-progress') {
    console.log(`[Billing] Call ${CallSid} answered. Charging immediately ${pricePerMinute} credits.`);

    const charged = await chargeUser(caller, pricePerMinute);
    if (!charged) {
      console.log(`[Billing] Not enough balance for first charge. Hanging up.`);
      try { await client.calls(CallSid).update({ status: 'completed' }); } 
      catch (err) { console.error('Error hanging up call:', err); }
      return res.sendStatus(200);
    }

    const intervalId = setInterval(async () => {
      const ok = await chargeUser(caller, pricePerMinute);
      if (!ok) {
        console.log(`[Billing] Balance empty. Hanging up call ${CallSid}.`);
        clearInterval(intervalId);
        activeIntervals.delete(CallSid);
        const callData = activeCalls.get(CallSid);
        if (callData) {
          try {
            await client.calls(callData.a).update({ status: 'completed' });
            await client.calls(callData.c).update({ status: 'completed' });
          } catch (err) {
            console.error('Error hanging up calls:', err);
          }
        }
        return;
      }

      // Проверяем баланс и проигрываем TTS при 6 кредитах
      const { data: user } = await supabase
        .from('customer_balances')
        .select('balance')
        .eq('phone_number', caller)
        .single();

      if (user && Number(user.balance) === 6) {
        console.log(`[ALERT] Caller ${caller} has only 6 credits.`);
        const callData = activeCalls.get(CallSid);
        const warningUrl = 'https://jowevbtruckcidckpzjj.supabase.co/storage/v1/object/public/burdial-audio/2%20min%20warning.mp3';

        if (callData) {
          try {
            await client.calls(callData.a).play({ url: warningUrl });
            await client.calls(callData.c).play({ url: warningUrl });
          } catch (err) {
            console.error('Error playing TTS:', err);
          }
        }

        broadcastToC({
          type: 'warning',
          message: 'You have one minute left. Please top up your balance.'
        });
      }
    }, 30000); // реальный биллинг 1 минута

    activeIntervals.set(CallSid, intervalId);
  }

  if (['completed', 'failed', 'no-answer', 'canceled'].includes(CallStatus)) {
    if (activeIntervals.has(CallSid)) {
      clearInterval(activeIntervals.get(CallSid));
      activeIntervals.delete(CallSid);
      console.log(`[Timer] Call ${CallSid} ended. Billing timer stopped.`);
    }
    activeCalls.delete(CallSid);
  }

  res.sendStatus(200);
});

// Списание средств
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
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
