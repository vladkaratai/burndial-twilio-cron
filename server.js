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
  const from = req.body.From; 
  const calledNumber = req.body.To; 
  const parentCallSid = req.body.CallSid;

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

    twimlResponse.dial({
      callerId: process.env.TWILIO_NUMBER,
      timeout: 60,
      statusCallback: callbackUrl,
      statusCallbackMethod: 'POST',
      // ИЗМЕНЕНО: Явно указываем Twilio присылать события 'answered' и 'completed'.
      // Это ключ к решению: сервер получит уведомление, как только клиент C ответит.
      statusCallbackEvent: 'answered completed', 
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
  switch (callStatus) {
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

  if (CallStatus === 'in-progress') {
    console.log(`[Billing] Call ${CallSid} answered. Charging immediately ${pricePerMinute} credits.`);

    const charged = await chargeUser(caller, pricePerMinute);
    if (!charged) {
      console.log(`[Billing] Not enough balance for first charge. Hanging up.`);
      try {
        await client.calls(CallSid).update({ status: 'completed' });
      } catch (err) {
        console.error('Error hanging up call:', err);
      }
      return res.sendStatus(200);
    }

    const intervalId = setInterval(async () => {
      console.log(`[Billing Tick] Charging ${pricePerMinute} credits for call ${CallSid}`);
      const ok = await chargeUser(caller, pricePerMinute);
      if (!ok) {
        console.log(`[Billing] Balance empty. Hanging up call ${CallSid}.`);
        clearInterval(intervalId);
        activeIntervals.delete(CallSid);
        try {
          await client.calls(CallSid).update({ status: 'completed' });
        } catch (err) {
          console.error('Error hanging up call:', err);
        }
      }
    }, 30000); 

    activeIntervals.set(CallSid, intervalId);
  }

  if (['completed', 'failed', 'no-answer', 'canceled'].includes(CallStatus)) {
    if (activeIntervals.has(CallSid)) {
      clearInterval(activeIntervals.get(CallSid));
      activeIntervals.delete(CallSid);
      console.log(`[Timer] Call ${CallSid} ended. Billing timer stopped.`);
    }
  }

  res.sendStatus(200);
});

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
\const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
