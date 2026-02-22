// Quick script to push workflow update to n8n (credentials already configured)
// Imports the workflow definition from update-n8n-workflow.mjs and pushes it

const N8N_URL = 'https://n8n.mommamiacaters.com';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYTE2ZmM4My00ZDQ4LTRlYjgtYmI3Yi1iNzQ1ZTE1MmFhMjgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDY1NGI1MjktNDkyNy00NDkxLWI3M2QtYzNhMzU0MzQ5YzMwIiwiaWF0IjoxNzcxNzg3MDc0fQ.GRkWQZxsLaSG5DGd-1AOGD5LOQ40h_hHU_-L7tA-RHs';
const WORKFLOW_ID = 'FoR6BuXgb094bY6q';

const n8nHeaders = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

// ============================================================
// NODE CODE: Build Groq Request
// ============================================================
const buildGroqRequestCode = `
const webhookData = $('Webhook Trigger').first().json;
const body = webhookData.body || webhookData;
const message = body.message || '';
const context = body.context || {};
const conversationHistory = context.conversationHistory || [];

const quoteSent = context.quoteSent === true;

const systemPrompt = \`You are the friendly AI assistant for Momma Mia Catering, a Filipino catering business.

PERSONALITY:
- Warm, friendly, conversational - like talking to a friend
- Keep responses concise (2-3 sentences max)
- NEVER repeat questions already answered in the conversation
- NEVER repeat summaries or confirmations you already gave
- ALWAYS maintain full context from conversation history

SERVICES & PRICING:
- Check-A-Lunch: Individual boxed meals (₱600-900), 1-2 days notice
- Party Trays: Serves 8-10 people (₱2,250-4,250), 2-3 days notice
- Fun Boxes: Mix & match boxes (₱750-1,250), 2-3 days notice
- Full Catering Service: ₱1,000-2,500 per person, 1-2 weeks notice
- Equipment Rental: Tables, chairs, etc (₱500-2,500/item), 3-5 days notice

QUOTE FLOW - When a customer wants a quote:
Ask them to provide ALL of the following details in one message:
1. Their name
2. Event type (birthday, wedding, corporate, etc.)
3. Number of guests (pax)
4. Preferred date and time
5. Food preferences or specific requests
6. Their email address

If they provide partial info, acknowledge what they gave and ask ONLY for the missing details. NEVER ask for info they already provided.

CRITICAL RULE - QUOTE_DATA TAG:
When you have ALL 6 pieces of information (name, event type, pax, date, food preferences, AND email), you MUST:
1. Confirm their details in a nice summary
2. Tell them you will send a detailed quote to their email within 24 hours
3. You MUST append this EXACT tag at the very end of your message (the system will strip it before showing to the customer):

[QUOTE_DATA]{"name":"their name","email":"their@email.com","eventType":"event type","pax":"number of guests","eventDate":"date and time","orderRequest":"food preferences and requests"}[/QUOTE_DATA]

NEVER skip the [QUOTE_DATA] tag when all info is collected. This is how the system saves their quote request. Without it, the quote is lost.

AFTER QUOTE IS SUBMITTED:
\${quoteSent ? 'IMPORTANT: The quote has ALREADY been submitted and emailed. Do NOT repeat the summary or say you will send a quote again. Instead, thank them warmly and let them know they can: 1) Start a new order, 2) Browse services & FAQs, or 3) Get another quote. Keep it short and friendly.' : ''}

CONTACT INFO:
- Email: mommamiacaters@gmail.com
- Facebook: Momma Mia Catering
- Instagram: @momma_mia_caters
- Website: mommamiacaters.com\`;

const messages = [{ role: "system", content: systemPrompt }];
for (const entry of conversationHistory) {
  messages.push({ role: "user", content: entry.message });
  messages.push({ role: "assistant", content: entry.response });
}
messages.push({ role: "user", content: message });

return [{
  json: {
    groqBody: {
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_completion_tokens: 512
    },
    originalMessage: message,
    originalContext: context
  }
}];
`;

// ============================================================
// NODE CODE: Enhanced Chatbot Logic
// ============================================================
const enhancedChatbotLogicCode = `
const groqResponse = $input.first().json;
const buildNode = $('Build Groq Request').first().json;
const originalMessage = buildNode.originalMessage;
const originalContext = buildNode.originalContext;

let aiResponse = '';
try {
  const choices = groqResponse.choices || [];
  if (choices.length > 0) {
    aiResponse = choices[0].message.content || '';
  }
} catch (e) {
  aiResponse = "Sorry, I'm having trouble right now. Please try again!";
}

let quoteData = null;
const quoteMatch = aiResponse.match(/\\[QUOTE_DATA\\]([\\s\\S]*?)\\[\\/QUOTE_DATA\\]/);
if (quoteMatch) {
  try {
    quoteData = JSON.parse(quoteMatch[1]);
  } catch (e) { /* ignore parse errors */ }
  aiResponse = aiResponse.replace(/\\s*\\[QUOTE_DATA\\][\\s\\S]*?\\[\\/QUOTE_DATA\\]\\s*/, '').trim();
}

const conversationHistory = [...(originalContext.conversationHistory || [])];
conversationHistory.push({
  message: originalMessage,
  response: aiResponse,
  timestamp: new Date().toISOString()
});
const previousMessages = [...(originalContext.previousMessages || []), originalMessage];

const msgLower = originalMessage.toLowerCase();
const intents = [];
if (/quote|price|cost|how much|estimate/i.test(msgLower)) intents.push('pricing');
if (/order|book|reserve|event|pax|people|guests/i.test(msgLower)) intents.push('order');
if (/service|offer|menu|lunch|tray|cater/i.test(msgLower)) intents.push('services');
if (intents.length === 0) intents.push('general');

let score = 0;
if (intents.includes('order') || intents.includes('pricing')) score += 30;
if (quoteData && quoteData.email) score += 30;
if (conversationHistory.length >= 3) score += 10;
const level = score >= 50 ? 'hot' : score >= 20 ? 'warm' : 'cold';
const priority = level === 'hot' ? 'high' : level === 'warm' ? 'medium' : 'low';

if (!quoteData) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/;
  let detectedEmail = null;
  for (const msg of previousMessages) {
    const match = msg.match(emailRegex);
    if (match) { detectedEmail = match[0]; break; }
  }
  if (detectedEmail && conversationHistory.length >= 4) {
    const lastBotResponse = conversationHistory[conversationHistory.length - 1].response;
    quoteData = {
      name: '',
      email: detectedEmail,
      eventType: '',
      pax: '',
      eventDate: '',
      orderRequest: lastBotResponse
    };
    const allText = previousMessages.join(' ');
    const paxMatch = allText.match(/(\\d+)\\s*(pax|people|guests|persons?)/i);
    if (paxMatch) quoteData.pax = paxMatch[1];
    const nameMatch = allText.match(/(?:my name is|i'm|i am)\\s+([a-zA-Z]+)/i);
    if (nameMatch) quoteData.name = nameMatch[1];
  }
}

const shouldSendEmail = (quoteData !== null && !!quoteData.email) ? 'yes' : 'no';

const orderRequest = (quoteData && quoteData.orderRequest) ? quoteData.orderRequest : conversationHistory
  .map(h => 'Customer: ' + h.message + '\\nBot: ' + h.response)
  .join('\\n---\\n');

const now = new Date().toISOString();
const qName = quoteData ? (quoteData.name || '') : '';
const qEmail = quoteData ? (quoteData.email || '') : '';
const qEventType = quoteData ? (quoteData.eventType || '') : '';
const qPax = quoteData ? (quoteData.pax || '') : '';
const qEventDate = quoteData ? (quoteData.eventDate || '') : '';
const qOrderRequest = orderRequest || '';

const emailSubject = 'New Quote Request from ' + qName + ' - ' + qEventType;
const emailHtml = '<h2 style="color:#E36A2E">New Quote Request from Chatbot</h2>' +
  '<table style="border-collapse:collapse;width:100%">' +
  '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#F3E7D8">Name</td><td style="padding:8px;border:1px solid #ddd">' + qName + '</td></tr>' +
  '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#F3E7D8">Email</td><td style="padding:8px;border:1px solid #ddd"><a href="mailto:' + qEmail + '">' + qEmail + '</a></td></tr>' +
  '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#F3E7D8">Event Type</td><td style="padding:8px;border:1px solid #ddd">' + qEventType + '</td></tr>' +
  '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#F3E7D8">Pax</td><td style="padding:8px;border:1px solid #ddd">' + qPax + '</td></tr>' +
  '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#F3E7D8">Event Date</td><td style="padding:8px;border:1px solid #ddd">' + qEventDate + '</td></tr>' +
  '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;background:#F3E7D8">Order Request</td><td style="padding:8px;border:1px solid #ddd">' + qOrderRequest + '</td></tr>' +
  '</table>' +
  '<p style="color:#999;font-size:12px;margin-top:20px">Submitted at ' + now + ' via Momma Mia Chatbot</p>';

return [{
  json: {
    response: aiResponse,
    timestamp: now,
    status: 'success',
    shouldSendEmail,
    qTimestamp: now,
    qName,
    qEmail,
    qEventType,
    qPax,
    qEventDate,
    qOrderRequest,
    emailSubject,
    emailHtml,
    leadScore: { score, level, priority, reasoning: 'Score: ' + score + ' based on intents: ' + intents.join(', ') },
    intents,
    context: {
      customerInfo: {
        ...(originalContext.customerInfo || {}),
        email: qEmail || null,
        urgency: score >= 50 ? 'high' : 'normal'
      },
      previousMessages,
      leadScore: { score, level, priority },
      lastIntents: intents,
      conversationHistory,
      quoteSent: originalContext.quoteSent === true || shouldSendEmail === 'yes'
    }
  }
}];
`;

// ============================================================
// Build the workflow
// ============================================================
const workflow = {
  name: "Momma Mia Chatbot",
  nodes: [
    {
      parameters: { httpMethod: "POST", path: "momma-mia-chat", responseMode: "responseNode", options: {} },
      id: "d5a8607f-c36b-4a1c-bac8-a9fe475998b1",
      name: "Webhook Trigger",
      type: "n8n-nodes-base.webhook",
      typeVersion: 1,
      position: [-500, -368],
      webhookId: "09b4a8ff-88bd-453a-aebe-db9530a6a95e"
    },
    {
      parameters: { jsCode: buildGroqRequestCode },
      id: "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "Build Groq Request",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [-250, -368]
    },
    {
      parameters: {
        method: "POST",
        url: "https://api.groq.com/openai/v1/chat/completions",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        sendHeaders: true,
        headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify($json.groqBody) }}",
        options: {}
      },
      id: "81a2fa1e-26b3-43db-a60d-b889ad49da79",
      name: "Groq AI",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.1,
      position: [0, -368],
      credentials: { httpHeaderAuth: { id: "6PBf5saZoesGoY0A", name: "Groq API Key" } }
    },
    {
      parameters: { jsCode: enhancedChatbotLogicCode },
      id: "793349ca-7baf-4f18-afa3-e910c75504a5",
      name: "Enhanced Chatbot Logic",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [250, -368]
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 1 },
          conditions: [{ id: "email-condition", leftValue: "={{ $json.shouldSendEmail }}", rightValue: "yes", operator: { type: "string", operation: "equals" } }],
          combinator: "and"
        },
        options: {}
      },
      id: "e592baaf-c117-441b-8903-5afd8079da18",
      name: "Should Send Email?",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [500, -368]
    },
    {
      parameters: {
        operation: "append",
        authentication: "serviceAccount",
        documentId: { __rl: true, value: "10DaGcvlPK5GpTcJD4rmCGPsMuCmrpd7-MppFBgAW8RM", mode: "id" },
        sheetName: { __rl: true, value: "QUOTES", mode: "name" },
        columns: {
          mappingMode: "defineBelow",
          value: {
            "Timestamp": "={{ $json.qTimestamp }}",
            "Name": "={{ $json.qName }}",
            "Email": "={{ $json.qEmail }}",
            "Event Type": "={{ $json.qEventType }}",
            "Pax": "={{ $json.qPax }}",
            "Event Date": "={{ $json.qEventDate }}",
            "Order Request": "={{ $json.qOrderRequest }}"
          },
          matchingColumns: [],
          schema: [
            { id: "Timestamp", displayName: "Timestamp", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "Name", displayName: "Name", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "Email", displayName: "Email", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "Event Type", displayName: "Event Type", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "Pax", displayName: "Pax", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "Event Date", displayName: "Event Date", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "Order Request", displayName: "Order Request", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true }
          ]
        },
        options: {}
      },
      id: "a1b2c3d4-sheets-node-0001-abcdef123456",
      name: "Save to Google Sheets",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4,
      position: [750, -500],
      credentials: { googleApi: { id: "nkZu4D4KZUEbwpTZ", name: "Google Sheets account" } },
      continueOnFail: true
    },
    {
      parameters: {
        fromEmail: "mommamiacaters@gmail.com",
        toEmail: "mommamiacaters@gmail.com",
        subject: "={{ $('Enhanced Chatbot Logic').first().json.emailSubject }}",
        html: "={{ $('Enhanced Chatbot Logic').first().json.emailHtml }}",
        options: {
          replyTo: "={{ $('Enhanced Chatbot Logic').first().json.qEmail }}"
        }
      },
      id: "4410cddc-9b71-4513-abe5-8ab70b1e216f",
      name: "Send Enhanced Lead Email",
      type: "n8n-nodes-base.emailSend",
      typeVersion: 2,
      position: [1000, -500],
      credentials: { smtp: { id: "contact-smtp-1", name: "Gmail SMTP - Contact Form" } },
      continueOnFail: true
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: "={{ { \"response\": $('Enhanced Chatbot Logic').first().json.response, \"timestamp\": $('Enhanced Chatbot Logic').first().json.timestamp, \"status\": \"success\", \"leadScore\": $('Enhanced Chatbot Logic').first().json.leadScore, \"intents\": $('Enhanced Chatbot Logic').first().json.intents, \"context\": $('Enhanced Chatbot Logic').first().json.context } }}",
        options: {}
      },
      id: "7aad7ba5-5738-4044-9d48-f605d7c8064d",
      name: "Enhanced Webhook Response",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1,
      position: [1250, -368]
    }
  ],
  connections: {
    "Webhook Trigger": { main: [[{ node: "Build Groq Request", type: "main", index: 0 }]] },
    "Build Groq Request": { main: [[{ node: "Groq AI", type: "main", index: 0 }]] },
    "Groq AI": { main: [[{ node: "Enhanced Chatbot Logic", type: "main", index: 0 }]] },
    "Enhanced Chatbot Logic": { main: [[{ node: "Should Send Email?", type: "main", index: 0 }]] },
    "Should Send Email?": {
      main: [
        [{ node: "Save to Google Sheets", type: "main", index: 0 }],
        [{ node: "Enhanced Webhook Response", type: "main", index: 0 }]
      ]
    },
    "Save to Google Sheets": { main: [[{ node: "Send Enhanced Lead Email", type: "main", index: 0 }]] },
    "Send Enhanced Lead Email": { main: [[{ node: "Enhanced Webhook Response", type: "main", index: 0 }]] }
  },
  settings: { executionOrder: "v1", saveDataSuccessExecution: "none" }
};

async function pushWorkflow() {
  console.log('Pushing updated workflow to n8n...');

  // Deactivate first
  await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}/deactivate`, { method: 'POST', headers: n8nHeaders });

  const response = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: n8nHeaders,
    body: JSON.stringify(workflow)
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Failed:', response.status, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('Workflow updated! Nodes:', data.nodes?.map(n => n.name).join(', '));

  // Reactivate
  const activateRes = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}/activate`, { method: 'POST', headers: n8nHeaders });
  console.log('Activated:', activateRes.ok);

  // Test
  console.log('\nTesting webhook...');
  const testRes = await fetch(`${N8N_URL}/webhook/momma-mia-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hi! What services do you offer?', context: {}, timestamp: new Date().toISOString() })
  });

  if (testRes.ok) {
    const testData = await testRes.json();
    console.log('Response:', testData.response?.substring(0, 200));
    console.log('Status:', testData.status);
  } else {
    console.log('Test failed:', testRes.status, await testRes.text());
  }
}

pushWorkflow().catch(console.error);
