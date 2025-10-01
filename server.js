// require('dotenv').config();
// const express = require('express');
// const bodyParser = require('body-parser');
// const { twiml } = require('twilio');
// const twilio = require('twilio');
// const cors = require('cors');

// const AccessToken = twilio.jwt.AccessToken;
// const VoiceGrant = AccessToken.VoiceGrant;

// const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
// const { createClient } = require('@supabase/supabase-js');

// const supabase = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_SERVICE_ROLE_KEY
// );

// const app = express();
// const corsOptions = {
//   origin: [
//     'http://localhost:5173',
//     process.env.DOMAIN_NAME
//   ],
//   credentials: true
// };
// app.use(cors(corsOptions));
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());

// const activeIntervals = new Map();
// const subscribers = new Set();
// const activeCalls = new Map()


// app.get('/events', (req, res) => {
//   res.setHeader('Content-Type', 'text/event-stream');
//   res.setHeader('Cache-Control', 'no-cache');
//   res.setHeader('Connection', 'keep-alive');
//   res.setHeader('Access-Control-Allow-Origin', '*'); 
//   res.setHeader('Access-Control-Allow-Credentials', 'true');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
//   res.flushHeaders();

//   console.log('New SSE client connected');
//   subscribers.add(res);
  
//   res.write(`data: ${JSON.stringify({type: 'connected', message: 'SSE connected'})}\n\n`);

//   req.on('close', () => {
//     console.log('SSE client disconnected');
//     subscribers.delete(res);
//   });
// });


// function broadcastToC(message) {
//   for (const res of subscribers) {
//     res.write(`data: ${JSON.stringify(message)}\n\n`);
//   }
// }

// app.get('/token-c', async (req, res) => {
//   res.header('Access-Control-Allow-Origin', '*');
//   const { creator_id } = req.query;
//   if (!creator_id) return res.status(400).json({ error: 'creator_id is required' });
//   try {
//     const token = new AccessToken(
//       process.env.TWILIO_SID,
//       process.env.TWILIO_API_KEY,
//       process.env.TWILIO_API_SECRET,
//       { identity: 'C' }
//     );
//     token.addGrant(new VoiceGrant({ incomingAllow: true }));
//     return res.json({ token: token.toJwt() });
//   } catch (err) {
//     console.error('Token generation error:', err);
//     return res.status(500).json({ error: 'Failed to generate token' });
//   }
// });

// app.post('/connect-client', (req, res) => {
//   const vr = new twiml.VoiceResponse();
// const longText =  `The Future of Artificial Intelligence: Transforming Our World
// Artificial Intelligence has rapidly evolved from a concept confined to science fiction novels to an integral part of our daily lives. As we stand at the threshold of what many experts call the fourth industrial revolution, it's crucial to understand how AI is reshaping every aspect of human existence, from healthcare and education to transportation and entertainment.
// The journey of artificial intelligence began in the 1950s when computer scientists first envisioned machines that could think and learn like humans. Early pioneers like Alan Turing laid the theoretical groundwork, proposing that machines could be created to exhibit intelligent behavior equivalent to, or indistinguishable from, that of a human. This concept, known as the Turing Test, remains a benchmark for measuring AI capabilities even today.
// For decades, AI development proceeded slowly, marked by periods of optimism followed by what researchers called "AI winters" – times when funding dried up and progress stagnated. However, the turn of the millennium brought unprecedented advances in computing power, data storage, and algorithm development that finally enabled the realization of many AI dreams.
// Today's AI systems operate on principles of machine learning, neural networks, and deep learning. These technologies allow computers to process vast amounts of data, recognize patterns, and make decisions with minimal human intervention. The algorithms powering modern AI can analyze millions of data points in seconds, identifying trends and insights that would take human analysts months or years to uncover.
// In healthcare, AI is revolutionizing patient care and medical research. Machine learning algorithms can now diagnose diseases with accuracy rates that match or exceed those of experienced physicians. AI-powered imaging systems can detect early-stage cancers, identify retinal diseases, and predict heart conditions by analyzing medical scans with superhuman precision. This technology is particularly valuable in regions where specialist doctors are scarce, potentially democratizing access to high-quality medical diagnosis.
// Drug discovery, traditionally a decade-long process costing billions of dollars, is being accelerated through AI. Machine learning models can predict how different compounds will interact with biological targets, identifying promising drug candidates in a fraction of the time previously required. This breakthrough has become especially relevant during global health crises, where rapid development of treatments and vaccines can save millions of lives.
// The financial sector has embraced AI for fraud detection, risk assessment, and automated trading. Banks now use sophisticated algorithms to monitor transactions in real-time, flagging suspicious activities and preventing fraudulent operations before they can cause significant damage. Investment firms employ AI to analyze market trends, economic indicators, and news sentiment to make trading decisions at speeds impossible for human traders to match.
// Transportation is undergoing a fundamental transformation through AI-powered autonomous vehicles. Self-driving cars, trucks, and delivery vehicles promise to reduce accidents caused by human error, optimize traffic flow, and provide mobility solutions for elderly and disabled individuals. While fully autonomous vehicles are still in testing phases, AI-assisted driving systems are already enhancing safety and convenience for millions of drivers worldwide.
// Education is being personalized through AI systems that adapt to individual learning styles and paces. Intelligent tutoring systems can identify knowledge gaps, provide customized practice problems, and adjust difficulty levels in real-time based on student performance. This technology has the potential to bridge educational inequalities by providing high-quality, personalized instruction to students regardless of their geographic location or economic background.
// The creative industries are also experiencing AI's influence. Artists, musicians, and writers are collaborating with AI tools to generate new forms of creative expression. AI can compose music, create visual art, write poetry, and even generate entire stories. While some view this as a threat to human creativity, others see it as a powerful tool that can augment human imagination and push creative boundaries.
// However, the rise of AI brings significant challenges and ethical considerations. Job displacement is a primary concern, as AI systems become capable of performing tasks traditionally done by humans. While AI creates new job categories, the transition period may be difficult for workers in affected industries. The key lies in reskilling and education programs that prepare the workforce for an AI-enhanced economy.
// Privacy and data security represent another major challenge. AI systems require vast amounts of data to function effectively, raising questions about how personal information is collected, stored, and used. Ensuring that AI development respects privacy rights while maintaining the data access necessary for innovation requires careful balance and robust regulatory frameworks.
// Algorithmic bias is a critical issue that can perpetuate and amplify existing societal inequalities. AI systems trained on biased data can make discriminatory decisions in hiring, lending, law enforcement, and other critical areas. Addressing this challenge requires diverse development teams, bias detection tools, and inclusive datasets that represent all segments of society.
// The question of AI consciousness and rights looms on the horizon. As AI systems become more sophisticated, philosophical and legal questions about their status and treatment will become increasingly relevant. While current AI lacks consciousness, continued advancement may eventually require society to grapple with complex questions about machine rights and responsibilities.
// Looking toward the future, several trends are likely to shape AI development. Quantum computing promises to exponentially increase processing power, enabling AI systems to tackle problems currently beyond their capabilities. Neuromorphic computing, which mimics the structure of the human brain, may lead to more efficient and powerful AI systems. Advances in natural language processing will make human-AI interaction more intuitive and natural.
// The integration of AI with other emerging technologies like the Internet of Things, blockchain, and biotechnology will create new possibilities and applications. Smart cities powered by AI will optimize energy usage, traffic flow, and resource allocation. AI-enhanced biotechnology may lead to personalized medicine tailored to individual genetic profiles.
// International competition in AI development is intensifying, with countries investing heavily in research and development. This competition drives innovation but also raises concerns about AI arms races and the potential military applications of AI technology. International cooperation and regulation will be essential to ensure AI development serves humanity's best interests.
// The environmental impact of AI is gaining attention as energy-intensive training processes raise concerns about carbon footprints. Developing more efficient algorithms and sustainable computing practices will be crucial for responsible AI development. Green AI initiatives focus on creating systems that deliver powerful capabilities while minimizing environmental impact.
// Despite challenges, the potential benefits of AI are enormous. AI can help address global challenges like climate change by optimizing energy systems, improving agricultural efficiency, and accelerating clean technology development. In scientific research, AI can process complex data sets, simulate molecular interactions, and identify patterns that advance our understanding of the universe.
// The path forward requires thoughtful consideration of AI's implications and careful planning to maximize benefits while minimizing risks. This includes investing in education and training programs, developing ethical guidelines and regulatory frameworks, and ensuring that AI development serves all of humanity rather than just a privileged few.
// As we continue to integrate AI into every aspect of our lives, maintaining human agency and oversight remains crucial. AI should augment human capabilities rather than replace human judgment entirely. The most successful AI implementations are those that combine artificial intelligence with human wisdom, creativity, and ethical reasoning.
// The next decade will likely see AI become even more ubiquitous and sophisticated. As we navigate this transformation, the choices we make today about AI development, deployment, and regulation will shape the future of human civilization. By approaching AI development thoughtfully and inclusively, we can harness its power to create a better world for all.
// The Future of Artificial Intelligence: Transforming Our World
// Artificial Intelligence has rapidly evolved from a concept confined to science fiction novels to an integral part of our daily lives. As we stand at the threshold of what many experts call the fourth industrial revolution, it's crucial to understand how AI is reshaping every aspect of human existence, from healthcare and education to transportation and entertainment.
// The journey of artificial intelligence began in the 1950s when computer scientists first envisioned machines that could think and learn like humans. Early pioneers like Alan Turing laid the theoretical groundwork, proposing that machines could be created to exhibit intelligent behavior equivalent to, or indistinguishable from, that of a human. This concept, known as the Turing Test, remains a benchmark for measuring AI capabilities even today.
// For decades, AI development proceeded slowly, marked by periods of optimism followed by what researchers called "AI winters" – times when funding dried up and progress stagnated. However, the turn of the millennium brought unprecedented advances in computing power, data storage, and algorithm development that finally enabled the realization of many AI dreams.
// Today's AI systems operate on principles of machine learning, neural networks, and deep learning. These technologies allow computers to process vast amounts of data, recognize patterns, and make decisions with minimal human intervention. The algorithms powering modern AI can analyze millions of data points in seconds, identifying trends and insights that would take human analysts months or years to uncover.
// In healthcare, AI is revolutionizing patient care and medical research. Machine learning algorithms can now diagnose diseases with accuracy rates that match or exceed those of experienced physicians. AI-powered imaging systems can detect early-stage cancers, identify retinal diseases, and predict heart conditions by analyzing medical scans with superhuman precision. This technology is particularly valuable in regions where specialist doctors are scarce, potentially democratizing access to high-quality medical diagnosis.
// Drug discovery, traditionally a decade-long process costing billions of dollars, is being accelerated through AI. Machine learning models can predict how different compounds will interact with biological targets, identifying promising drug candidates in a fraction of the time previously required. This breakthrough has become especially relevant during global health crises, where rapid development of treatments and vaccines can save millions of lives.
// The financial sector has embraced AI for fraud detection, risk assessment, and automated trading. Banks now use sophisticated algorithms to monitor transactions in real-time, flagging suspicious activities and preventing fraudulent operations before they can cause significant damage. Investment firms employ AI to analyze market trends, economic indicators, and news sentiment to make trading decisions at speeds impossible for human traders to match.
// Transportation is undergoing a fundamental transformation through AI-powered autonomous vehicles. Self-driving cars, trucks, and delivery vehicles promise to reduce accidents caused by human error, optimize traffic flow, and provide mobility solutions for elderly and disabled individuals. While fully autonomous vehicles are still in testing phases, AI-assisted driving systems are already enhancing safety and convenience for millions of drivers worldwide.
// Education is being personalized through AI systems that adapt to individual learning styles and paces. Intelligent tutoring systems can identify knowledge gaps, provide customized practice problems, and adjust difficulty levels in real-time based on student performance. This technology has the potential to bridge educational inequalities by providing high-quality, personalized instruction to students regardless of their geographic location or economic background.
// The creative industries are also experiencing AI's influence. Artists, musicians, and writers are collaborating with AI tools to generate new forms of creative expression. AI can compose music, create visual art, write poetry, and even generate entire stories. While some view this as a threat to human creativity, others see it as a powerful tool that can augment human imagination and push creative boundaries.
// However, the rise of AI brings significant challenges and ethical considerations. Job displacement is a primary concern, as AI systems become capable of performing tasks traditionally done by humans. While AI creates new job categories, the transition period may be difficult for workers in affected industries. The key lies in reskilling and education programs that prepare the workforce for an AI-enhanced economy.
// Privacy and data security represent another major challenge. AI systems require vast amounts of data to function effectively, raising questions about how personal information is collected, stored, and used. Ensuring that AI development respects privacy rights while maintaining the data access necessary for innovation requires careful balance and robust regulatory frameworks.
// Algorithmic bias is a critical issue that can perpetuate and amplify existing societal inequalities. AI systems trained on biased data can make discriminatory decisions in hiring, lending, law enforcement, and other critical areas. Addressing this challenge requires diverse development teams, bias detection tools, and inclusive datasets that represent all segments of society.
// The question of AI consciousness and rights looms on the horizon. As AI systems become more sophisticated, philosophical and legal questions about their status and treatment will become increasingly relevant. While current AI lacks consciousness, continued advancement may eventually require society to grapple with complex questions about machine rights and responsibilities.
// Looking toward the future, several trends are likely to shape AI development. Quantum computing promises to exponentially increase processing power, enabling AI systems to tackle problems currently beyond their capabilities. Neuromorphic computing, which mimics the structure of the human brain, may lead to more efficient and powerful AI systems. Advances in natural language processing will make human-AI interaction more intuitive and natural.
// The integration of AI with other emerging technologies like the Internet of Things, blockchain, and biotechnology will create new possibilities and applications. Smart cities powered by AI will optimize energy usage, traffic flow, and resource allocation. AI-enhanced biotechnology may lead to personalized medicine tailored to individual genetic profiles.
// International competition in AI development is intensifying, with countries investing heavily in research and development. This competition drives innovation but also raises concerns about AI arms races and the potential military applications of AI technology. International cooperation and regulation will be essential to ensure AI development serves humanity's best interests.
// The environmental impact of AI is gaining attention as energy-intensive training processes raise concerns about carbon footprints. Developing more efficient algorithms and sustainable computing practices will be crucial for responsible AI development. Green AI initiatives focus on creating systems that deliver powerful capabilities while minimizing environmental impact.
// Despite challenges, the potential benefits of AI are enormous. AI can help address global challenges like climate change by optimizing energy systems, improving agricultural efficiency, and accelerating clean technology development. In scientific research, AI can process complex data sets, simulate molecular interactions, and identify patterns that advance our understanding of the universe.
// The path forward requires thoughtful consideration of AI's implications and careful planning to maximize benefits while minimizing risks. This includes investing in education and training programs, developing ethical guidelines and regulatory frameworks, and ensuring that AI development serves all of humanity rather than just a privileged few.
// As we continue to integrate AI into every aspect of our lives, maintaining human agency and oversight remains crucial. AI should augment human capabilities rather than replace human judgment entirely. The most successful AI implementations are those that combine artificial intelligence with human wisdom, creativity, and ethical reasoning.
// The next decade will likely see AI become even more ubiquitous and sophisticated. As we navigate this transformation, the choices we make today about AI development, deployment, and regulation will shape the future of human civilization. By approaching AI development thoughtfully and inclusively, we can harness its power to create a better world for all.
// The Future of Artificial Intelligence: Transforming Our World
// Artificial Intelligence has rapidly evolved from a concept confined to science fiction novels to an integral part of our daily lives. As we stand at the threshold of what many experts call the fourth industrial revolution, it's crucial to understand how AI is reshaping every aspect of human existence, from healthcare and education to transportation and entertainment.
// The journey of artificial intelligence began in the 1950s when computer scientists first envisioned machines that could think and learn like humans. Early pioneers like Alan Turing laid the theoretical groundwork, proposing that machines could be created to exhibit intelligent behavior equivalent to, or indistinguishable from, that of a human. This concept, known as the Turing Test, remains a benchmark for measuring AI capabilities even today.
// For decades, AI development proceeded slowly, marked by periods of optimism followed by what researchers called "AI winters" – times when funding dried up and progress stagnated. However, the turn of the millennium brought unprecedented advances in computing power, data storage, and algorithm development that finally enabled the realization of many AI dreams.
// Today's AI systems operate on principles of machine learning, neural networks, and deep learning. These technologies allow computers to process vast amounts of data, recognize patterns, and make decisions with minimal human intervention. The algorithms powering modern AI can analyze millions of data points in seconds, identifying trends and insights that would take human analysts months or years to uncover.
// In healthcare, AI is revolutionizing patient care and medical research. Machine learning algorithms can now diagnose diseases with accuracy rates that match or exceed those of experienced physicians. AI-powered imaging systems can detect early-stage cancers, identify retinal diseases, and predict heart conditions by analyzing medical scans with superhuman precision. This technology is particularly valuable in regions where specialist doctors are scarce, potentially democratizing access to high-quality medical diagnosis.
// Drug discovery, traditionally a decade-long process costing billions of dollars, is being accelerated through AI. Machine learning models can predict how different compounds will interact with biological targets, identifying promising drug candidates in a fraction of the time previously required. This breakthrough has become especially relevant during global health crises, where rapid development of treatments and vaccines can save millions of lives.
// The financial sector has embraced AI for fraud detection, risk assessment, and automated trading. Banks now use sophisticated algorithms to monitor transactions in real-time, flagging suspicious activities and preventing fraudulent operations before they can cause significant damage. Investment firms employ AI to analyze market trends, economic indicators, and news sentiment to make trading decisions at speeds impossible for human traders to match.
// Transportation is undergoing a fundamental transformation through AI-powered autonomous vehicles. Self-driving cars, trucks, and delivery vehicles promise to reduce accidents caused by human error, optimize traffic flow, and provide mobility solutions for elderly and disabled individuals. While fully autonomous vehicles are still in testing phases, AI-assisted driving systems are already enhancing safety and convenience for millions of drivers worldwide.
// Education is being personalized through AI systems that adapt to individual learning styles and paces. Intelligent tutoring systems can identify knowledge gaps, provide customized practice problems, and adjust difficulty levels in real-time based on student performance. This technology has the potential to bridge educational inequalities by providing high-quality, personalized instruction to students regardless of their geographic location or economic background.
// The creative industries are also experiencing AI's influence. Artists, musicians, and writers are collaborating with AI tools to generate new forms of creative expression. AI can compose music, create visual art, write poetry, and even generate entire stories. While some view this as a threat to human creativity, others see it as a powerful tool that can augment human imagination and push creative boundaries.
// However, the rise of AI brings significant challenges and ethical considerations. Job displacement is a primary concern, as AI systems become capable of performing tasks traditionally done by humans. While AI creates new job categories, the transition period may be difficult for workers in affected industries. The key lies in reskilling and education programs that prepare the workforce for an AI-enhanced economy.
// Privacy and data security represent another major challenge. AI systems require vast amounts of data to function effectively, raising questions about how personal information is collected, stored, and used. Ensuring that AI development respects privacy rights while maintaining the data access necessary for innovation requires careful balance and robust regulatory frameworks.
// Algorithmic bias is a critical issue that can perpetuate and amplify existing societal inequalities. AI systems trained on biased data can make discriminatory decisions in hiring, lending, law enforcement, and other critical areas. Addressing this challenge requires diverse development teams, bias detection tools, and inclusive datasets that represent all segments of society.
// The question of AI consciousness and rights looms on the horizon. As AI systems become more sophisticated, philosophical and legal questions about their status and treatment will become increasingly relevant. While current AI lacks consciousness, continued advancement may eventually require society to grapple with complex questions about machine rights and responsibilities.
// Looking toward the future, several trends are likely to shape AI development. Quantum computing promises to exponentially increase processing power, enabling AI systems to tackle problems currently beyond their capabilities. Neuromorphic computing, which mimics the structure of the human brain, may lead to more efficient and powerful AI systems. Advances in natural language processing will make human-AI interaction more intuitive and natural.
// The integration of AI with other emerging technologies like the Internet of Things, blockchain, and biotechnology will create new possibilities and applications. Smart cities powered by AI will optimize energy usage, traffic flow, and resource allocation. AI-enhanced biotechnology may lead to personalized medicine tailored to individual genetic profiles.
// International competition in AI development is intensifying, with countries investing heavily in research and development. This competition drives innovation but also raises concerns about AI arms races and the potential military applications of AI technology. International cooperation and regulation will be essential to ensure AI development serves humanity's best interests.
// The environmental impact of AI is gaining attention as energy-intensive training processes raise concerns about carbon footprints. Developing more efficient algorithms and sustainable computing practices will be crucial for responsible AI development. Green AI initiatives focus on creating systems that deliver powerful capabilities while minimizing environmental impact.
// Despite challenges, the potential benefits of AI are enormous. AI can help address global challenges like climate change by optimizing energy systems, improving agricultural efficiency, and accelerating clean technology development. In scientific research, AI can process complex data sets, simulate molecular interactions, and identify patterns that advance our understanding of the universe.
// The path forward requires thoughtful consideration of AI's implications and careful planning to maximize benefits while minimizing risks. This includes investing in education and training programs, developing ethical guidelines and regulatory frameworks, and ensuring that AI development serves all of humanity rather than just a privileged few.
// As we continue to integrate AI into every aspect of our lives, maintaining human agency and oversight remains crucial. AI should augment human capabilities rather than replace human judgment entirely. The most successful AI implementations are those that combine artificial intelligence with human wisdom, creativity, and ethical reasoning.
// The next decade will likely see AI become even more ubiquitous and sophisticated. As we navigate this transformation, the choices we make today about AI development, deployment, and regulation will shape the future of human civilization. By approaching AI development thoughtfully and inclusively, we can harness its power to create a better world for all.`
//  const chunkSize = 4000;
//   const chunks = [];
//   let remainingText = longText;
//   while (remainingText.length > 0) {
//     chunks.push(remainingText.slice(0, chunkSize));
//     remainingText = remainingText.slice(chunkSize);
//   }

//   chunks.forEach((chunk) => {
//     vr.say({ voice: 'alice' }, chunk);
//     vr.pause({ length: 1 });
//   });
// vr.pause({length: 86400}); 


//   res.type('text/xml').send(vr.toString());
// });

// app.post('/incoming-call', async (req, res) => {
//   const from = req.body.From; 
//   const calledNumber = req.body.To; 

//   const twimlResponse = new twiml.VoiceResponse();

//   try {
//     const { data: serviceNumber, error: snErr } = await supabase
//       .from('service_numbers')
//       .select('id, number, creator_id, price_per_minute')
//       .eq('number', calledNumber)
//       .single();

//     if (snErr || !serviceNumber) {
//       twimlResponse.say('Service unavailable.');
//       twimlResponse.hangup();
//       return res.type('text/xml').send(twimlResponse.toString());
//     }

//     const pricePerMinute = Number(serviceNumber.price_per_minute) || 3;

//     const { data: user, error: userErr } = await supabase
//       .from('customer_balances')
//       .select('id, balance')
//       .eq('phone_number', from)
//       .single();

//     if (userErr || !user) {
//       twimlResponse.say('Account not found.');
//       twimlResponse.hangup();
//       return res.type('text/xml').send(twimlResponse.toString());
//     }

//     const balance = Number(user.balance);
//     if (balance < pricePerMinute) {
//       console.log(`[BLOCK CALL] Caller ${from} has only ${balance}, required ${pricePerMinute}. Call denied.`);
//       twimlResponse.say('You have insufficient funds to make this call.');
//       twimlResponse.hangup();
//       return res.type('text/xml').send(twimlResponse.toString());
//     }

//     console.log(`[ProxyCall] A=${from} → client:C. Setting up status callback.`);

//     twimlResponse.dial({
//       callerId: process.env.TWILIO_NUMBER,
//       timeout: 60
//     }).client({
//       statusCallback: `${process.env.DOMAIN_NAME}/call-status-handler?caller=${encodeURIComponent(from)}&price=${pricePerMinute}`,
//       statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
//       url: `${process.env.DOMAIN_NAME}/connect-client`
//     }, 'C');

//     return res.type('text/xml').send(twimlResponse.toString());

//   } catch (err) {
//     console.error('Error in /incoming-call:', err);
//     twimlResponse.say('A system error occurred.');
//     twimlResponse.hangup();
//     return res.type('text/xml').send(twimlResponse.toString());
//   }
// });

// app.post('/call-status-handler', async (req, res) => {
//   const { CallSid, CallStatus } = req.body;
//   const { caller, price } = req.query;
//   const pricePerMinute = Number(price);

//   console.log(`[StatusCallback] CallSid: ${CallSid}, Status: ${CallStatus}, Caller: ${caller}`);

//   if (CallStatus === 'in-progress') {
//     console.log(`[Billing] Call ${CallSid} answered. Charging immediately ${pricePerMinute} credits.`);

//     const charged = await chargeUser(caller, pricePerMinute);
//     if (!charged) {
//       console.log(`[Billing] Not enough balance for first charge. Hanging up.`);
//       try {
//         await client.calls(CallSid).update({ status: 'completed' });
//       } catch (err) {
//         console.error('Error hanging up call:', err);
//       }
//       return res.sendStatus(200);
//     }

//     activeCalls.set(CallSid, {
//       a: CallSid, 
//       c: 'C',     
//       warningSent: false, 
//       smsSent: false      
//     });

//     const intervalId = setInterval(async () => {
//       console.log(`[Billing Tick] Charging ${pricePerMinute} credits for call ${CallSid}`);
      
//       const { data: userBeforeCharge, error: userErrBefore } = await supabase
//         .from('customer_balances')
//         .select('balance')
//         .eq('phone_number', caller)
//         .single();

//       if (userErrBefore || !userBeforeCharge) {
//         console.error('[SUPABASE] User not found before charge for checks', userErrBefore);
//       } else {
//         const currentBalance = Number(userBeforeCharge.balance);
//         const pricePerTick = pricePerMinute; 
//         const secondsPerTick = 60;
//         const warningThresholdSeconds = 300; //5 min in seconds

//         const possibleTicksRemaining = Math.floor(currentBalance / pricePerTick);
//         const secondsRemaining = possibleTicksRemaining * secondsPerTick;

//         const callInfo = activeCalls.get(CallSid);
//         if (secondsRemaining <= warningThresholdSeconds && secondsRemaining > 0 && !callInfo.warningSent) {
//           console.log(`[ALERT] Caller ${caller} has ${secondsRemaining} seconds left.`);
          
//           const warningUrl = 'https://jowevbtruckcidckpzjj.supabase.co/storage/v1/object/public/burdial-audio/2%20min%20warning.mp3';
          
//           broadcastToC({
//             type: 'warning',
//             message: `You have ${Math.ceil(secondsRemaining / 60)} minute(s) left. Please top up your balance.`,
//             audioUrl: warningUrl
//           });

//           callInfo.warningSent = true;
//           activeCalls.set(CallSid, callInfo);
//         }

//         if (currentBalance < pricePerTick && !callInfo.smsSent) { 
//           console.log(`[SMS ALERT] Caller ${caller} has ${currentBalance} credits, which is not enough for the next billing cycle (${pricePerTick} credits). SMS sent.`);
//           try {
//             await client.messages.create({
//               body: 'Your credits are running out and will not cover the next billing cycle. Please top up your balance at: https://burndial.lovable.app/demo/topup',
//               from: process.env.TWILIO_NUMBER,
//               to: caller
//             });
//             console.log(`[SMS] Sent low-credit warning to ${caller}`);
//             callInfo.smsSent = true; 
//             activeCalls.set(CallSid, callInfo);
//           } catch (smsErr) {
//             console.error('[SMS] Failed to send low-credit SMS:', smsErr);
//           }
//         }
//       }

//       const ok = await chargeUser(caller, pricePerMinute);
//       if (!ok) {
//         console.log(`[Billing] Balance empty. Hanging up call ${CallSid}.`);
//         clearInterval(intervalId);
//         activeIntervals.delete(CallSid);
//         try {
//           await client.calls(CallSid).update({ status: 'completed' });
//         } catch (err) {
//           console.error('Error hanging up call:', err);
//         }
//         return;
//       }
//     }, 60000); // 60 min

//     activeIntervals.set(CallSid, intervalId);
//   }

//   if (['completed', 'failed', 'no-answer', 'canceled'].includes(CallStatus)) {
//     if (activeIntervals.has(CallSid)) {
//       clearInterval(activeIntervals.get(CallSid));
//       activeIntervals.delete(CallSid);
//       console.log(`[Timer] Call ${CallSid} ended. Billing timer stopped.`);
//     }
//     activeCalls.delete(CallSid);
//   }

//   res.sendStatus(200);
// });
// async function chargeUser(phone, amount = 3) {
//   const { data: user, error: userErr } = await supabase
//     .from('customer_balances')
//     .select('id, balance')
//     .eq('phone_number', phone)
//     .single();

//   if (userErr || !user) {
//     console.error('[SUPABASE] User not found for charging', userErr);
//     return false;
//   }

//   if (Number(user.balance) < amount) {
//     console.log(`[CREDITS] Not enough balance for ${phone}. Has ${user.balance}, needs ${amount}`);
//     return false;
//   }

//   const newBalance = Number(user.balance) - amount;
//   const { error } = await supabase
//     .from('customer_balances')
//     .update({ balance: newBalance })
//     .eq('id', user.id);

//   if (error) {
//     console.error('[SUPABASE] Failed to update balance', error);
//     return false;
//   }

//   console.log(`[CREDITS] Charged ${amount} from ${phone}, new balance is ${newBalance}`);
//   return true;
// }
// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });


require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
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
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  path: '/media-stream' // Twilio будет подключаться сюда
});

const corsOptions = {
  origin: [
    'http://localhost:5173',
    process.env.DOMAIN_NAME
  ],
  credentials: true
};
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const activeIntervals = new Map();
const subscribers = new Set();
const activeCalls = new Map();

// SSE для уведомлений
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  res.flushHeaders();

  console.log('New SSE client connected');
  subscribers.add(res);
  
  res.write(`data: ${JSON.stringify({type: 'connected', message: 'SSE connected'})}\n\n`);

  req.on('close', () => {
    console.log('SSE client disconnected');
    subscribers.delete(res);
  });
});

function broadcastToC(message) {
  for (const res of subscribers) {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  }
}

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

// Теперь /connect-client использует Stream API для двусторонней связи
app.post('/connect-client', (req, res) => {
  const vr = new twiml.VoiceResponse();

  // Подключаем вызов к аудио-стриму из браузера
  vr.connect((node) => {
    node.stream({
      url: `${process.env.DOMAIN_NAME || 'https://your-domain.com'}/media-stream` // УБРАЛ ПРОБЕЛЫ
    });
  });

  res.type('text/xml').send(vr.toString());
});

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

    twimlResponse.dial({
      callerId: process.env.TWILIO_NUMBER,
      timeout: 60
    }).client({
      statusCallback: `${process.env.DOMAIN_NAME}/call-status-handler?caller=${encodeURIComponent(from)}&price=${pricePerMinute}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      url: `${process.env.DOMAIN_NAME}/connect-client`
    }, 'C');

    return res.type('text/xml').send(twimlResponse.toString());

  } catch (err) {
    console.error('Error in /incoming-call:', err);
    twimlResponse.say('A system error occurred.');
    twimlResponse.hangup();
    return res.type('text/xml').send(twimlResponse.toString());
  }
});

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

    activeCalls.set(CallSid, {
      a: CallSid, 
      c: 'C',     
      warningSent: false, 
      smsSent: false      
    });

    const intervalId = setInterval(async () => {
      console.log(`[Billing Tick] Charging ${pricePerMinute} credits for call ${CallSid}`);
      
      const { data: userBeforeCharge, error: userErrBefore } = await supabase
        .from('customer_balances')
        .select('balance')
        .eq('phone_number', caller)
        .single();

      if (userErrBefore || !userBeforeCharge) {
        console.error('[SUPABASE] User not found before charge for checks', userErrBefore);
      } else {
        const currentBalance = Number(userBeforeCharge.balance);
        const pricePerTick = pricePerMinute; 
        const secondsPerTick = 60;
        const warningThresholdSeconds = 300; //5 min in seconds

        const possibleTicksRemaining = Math.floor(currentBalance / pricePerTick);
        const secondsRemaining = possibleTicksRemaining * secondsPerTick;

        const callInfo = activeCalls.get(CallSid);
        if (secondsRemaining <= warningThresholdSeconds && secondsRemaining > 0 && !callInfo.warningSent) {
          console.log(`[ALERT] Caller ${caller} has ${secondsRemaining} seconds left.`);
          
          const warningUrl = 'https://jowevbtruckcidckpzjj.supabase.co/storage/v1/object/public/burdial-audio/2%20min%20warning.mp3'; // УБРАЛ ПРОБЕЛЫ
          
          broadcastToC({
            type: 'warning',
            message: `You have ${Math.ceil(secondsRemaining / 60)} minute(s) left. Please top up your balance.`,
            audioUrl: warningUrl
          });

          callInfo.warningSent = true;
          activeCalls.set(CallSid, callInfo);
        }

        if (currentBalance < pricePerTick && !callInfo.smsSent) { 
          console.log(`[SMS ALERT] Caller ${caller} has ${currentBalance} credits, which is not enough for the next billing cycle (${pricePerTick} credits). SMS sent.`);
          try {
            await client.messages.create({
              body: 'Your credits are running out and will not cover the next billing cycle. Please top up your balance at: https://burndial.lovable.app/demo/topup', // УБРАЛ ПРОБЕЛЫ
              from: process.env.TWILIO_NUMBER,
              to: caller
            });
            console.log(`[SMS] Sent low-credit warning to ${caller}`);
            callInfo.smsSent = true; 
            activeCalls.set(CallSid, callInfo);
          } catch (smsErr) {
            console.error('[SMS] Failed to send low-credit SMS:', smsErr);
          }
        }
      }

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
        return;
      }
    }, 60000);

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

// WebSocket для Stream API (Twilio -> сервер)
io.of('/media-stream').on('connection', (socket) => {
  console.log('Twilio media stream connected');

  socket.on('message', (data) => {
    try {
      const payload = JSON.parse(data);
      if (payload.event === 'start') {
        console.log('Stream started by Twilio');
      } else if (payload.event === 'media') {
        // Тут Twilio отправляет аудио от вызова A
        // payload.media содержит аудио от A, которое C будет слышать
        console.log('[LOG] Audio received from A (caller):', payload.media.payload.length, 'bytes');
      } else if (payload.event === 'stop') {
        console.log('Stream ended');
      }
    } catch (e) {
      console.error('Error parsing stream message:', e);
    }
  });

  socket.on('disconnect', () => {
    console.log('Twilio media stream disconnected');
  });
});

// Новый WebSocket для получения аудио от браузера C (браузер -> сервер -> Twilio)
io.of('/browser-audio').on('connection', (socket) => {
  console.log('Browser audio stream connected');

  socket.on('audio', (data) => {
    // Логируем аудио от C (браузера)
    console.log('[LOG] Audio received from C (browser):', data.length, 'bytes');
    // data - это Int16Array буфер от браузера
    // Twilio ожидает 8kHz, 16-bit PCM
    // В реальном приложении тут нужно отправить аудио в Twilio Stream
  });

  socket.on('disconnect', () => {
    console.log('Browser audio stream disconnected');
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});