require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { twiml } = require('twilio');
const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const activeIntervals = new Map();

app.post('/incoming-call', async (req, res) => {
  const from = req.body.From;   // A
  const calledNumber = req.body.To; // B
  const DOMAIN_NAME = process.env.DOMAIN_NAME;

  const twimlResponse = new twiml.VoiceResponse();

  try {
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

    const targetNumber = creator.phone;

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

    console.log(`[ProxyCall] A=${from} → C=${targetNumber}, CallSid=${req.body.CallSid}`);

    const dial = twimlResponse.dial({
      callerId: process.env.TWILIO_NUMBER,
      action: `${DOMAIN_NAME}/dial-status`, // continuation
      method: 'POST',
      answerOnBridge: true,
  
    });
    dial.number(targetNumber);

    return res.type('text/xml').send(twimlResponse.toString());

  } catch (err) {
    console.error(err);
    twimlResponse.say('System error.');
    twimlResponse.hangup();
    return res.type('text/xml').send(twimlResponse.toString());
  }
});

// app.post('/dial-status', async (req, res) => {
//   const callSid = req.body.CallSid;
//   const from = req.body.From;

//   console.log(`[CALL] Соединение установлено. CallSid=${callSid}, A=${from}`);

//   await chargeUser(from);

//   const intervalId = setInterval(async () => {
//     const credits = await getUserCredits(from);
//     if (credits >= 3) {
//       await chargeUser(from);
//     } else {
//       console.log(`[CALL] У ${from} кончились кредиты. Завершаем звонок ${callSid}`);
//       await client.calls(callSid).update({ status: 'completed' });
//       clearInterval(intervalId);
//       activeIntervals.delete(callSid);
//     }
//   }, 60 * 1000);

//   activeIntervals.set(callSid, intervalId);
//   return res.sendStatus(200);
// });
app.post('/dial-status', async (req, res) => {
  const callSid = req.body.CallSid;
  const from = req.body.From;
  const dialCallStatus = req.body.DialCallStatus; // answered, completed, busy и т.д.

  // Первая минута
  if (dialCallStatus === 'answered') {
    console.log(`[CALL] Разговор начался. CallSid=${callSid}, A=${from}`);
    await chargeUser(from); // списываем первую минуту

    // Запускаем таймер на каждую последующую минуту
    const intervalId = setInterval(async () => {
      const credits = await getUserCredits(from);
      if (credits >= 3) {
        await chargeUser(from);
      } else {
        console.log(`[CALL] У ${from} кончились кредиты. Завершаем звонок ${callSid}`);
        await client.calls(callSid).update({ status: 'completed' });
        clearInterval(intervalId);
        activeIntervals.delete(callSid);
      }
    }, 60 * 1000); // каждую минуту

    activeIntervals.set(callSid, intervalId);
  }

  res.sendStatus(200);
});

app.post('/call-status', (req, res) => {
  const callSid = req.body.CallSid;
  if (activeIntervals.has(callSid)) {
    clearInterval(activeIntervals.get(callSid));
    activeIntervals.delete(callSid);
    console.log(`[CALL] CallSid=${callSid} завершён. Таймер удалён.`);
  }
  res.sendStatus(200);
});

async function getUserCredits(phone) {
  const { data, error } = await supabase
    .from('customer_balances')
    .select('balance')
    .eq('phone_number', phone)
    .single();
  return error || !data ? 0 : Number(data.balance);
}

async function chargeUser(phone) {
  const price = 3; 
  const { data: user, error: userErr } = await supabase
    .from('customer_balances')
    .select('id, balance')
    .eq('phone_number', phone)
    .single();

  if (userErr || !user) {
    console.error('User not found for charging', userErr);
    return;
  }

  const newBalance = Math.max(0, Number(user.balance) - price);

  await supabase
    .from('customer_balances')
    .update({ balance: newBalance })
    .eq('id', user.id);

  console.log(`[CREDITS] Списано ${price} у ${phone}, остаток ${newBalance}`);
}

app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server запущен на http://localhost:${process.env.PORT || 3000}`);
});
