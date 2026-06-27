// Supabase Edge Function: chat
// -----------------------------------------------------------------------------
// The Momma Mia website chatbot, moved off the self-hosted n8n webhook
// (n8n.mommamiacaters.com/webhook/momma-mia-chat) onto a managed, always-
// reachable Edge Function. It speaks the SAME request/response contract the chat
// widget already uses, so apps/web/src/components/Chatbot/Chatbot.tsx only swaps
// its URL (+ sends the Supabase anon key).
//
// Port of the old n8n "Build Request" + "Enhanced Chatbot Logic" code nodes:
//   1. Replay the client-held conversation history into Google Gemini 2.5 Flash
//      with the Momma Mia catering system prompt.
//   2. Post-process the reply: extract + strip the hidden [QUOTE_DATA] tag,
//      detect intents, compute a lead score, and (fallback) sniff an email from
//      the transcript when the model forgets the tag.
//   3. When a full quote is collected, insert a row into public.quote_requests
//      via the service role. An AFTER INSERT trigger then emails the owner
//      through the order-notify function (Resend) — no Google Sheets.
//   4. Echo the updated conversation context back so the (stateless) widget can
//      resend it next turn.
//
// Auth: public (verify_jwt = false in config.toml) + permissive CORS, because
// the storefront calls it directly from the browser — exactly like the old
// webhook. Input is size-capped to bound LLM cost per call. NOTE: this is not
// rate-limited; a determined caller could run up Gemini usage. The old n8n
// webhook had the identical exposure — see docs for the recommended follow-up
// (edge rate-limit / Turnstile) before high traffic.
//
// Deploy:  supabase functions deploy chat --project-ref fbzwicfvhrtyfqjounvo
// Secrets: supabase secrets set GEMINI_API_KEY=…
//          (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected.)
// -----------------------------------------------------------------------------

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Bound per-call cost: refuse absurd inputs, and only replay a recent window of
// history to the model (the widget can accumulate a long transcript).
const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_TURNS = 40;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Verbatim from the old n8n "Build Groq Request" code node (system prompt).
const SYSTEM_PROMPT = `You are the friendly AI assistant for Momma Mia Catering, a Filipino catering business.

PERSONALITY:
- Warm, friendly, conversational - like talking to a friend
- Keep responses concise (2-3 sentences max)
- NEVER repeat questions already answered in the conversation
- ALWAYS maintain full context from conversation history

SERVICES & PRICING:
- Check-A-Lunch: Build-your-own boxed lunches. Balanced Diet ₱195/box (1 main, 1 side, 1 starch) or Double The Protein ₱265/box (2 mains, 1 side, 1 starch). Minimum 15 boxes per order. Customers can order and PAY ONLINE on the website — no need to wait for a quote.
- Party Trays: Serves 8-10 people (₱2,250-4,250), 2-3 days notice
- Fun Boxes: Mix & match boxes (₱750-1,250), 2-3 days notice
- Full Catering Service: ₱1,000-2,500 per person, 1-2 weeks notice
- Equipment Rental: Tables, chairs, etc (₱500-2,500/item), 3-5 days notice

ONLINE ORDERING (Check-A-Lunch only):
Direct customers to the website to build their lunch boxes (minimum 15), then pay via GCash, Maya, or bank app (InstaPay QR) and upload their payment receipt at checkout. For Party Trays, Fun Boxes, Full Catering and Equipment Rental, collect a quote instead (see QUOTE FLOW).

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

CONTACT INFO:
- Email: mommamiacaters@gmail.com
- Facebook: Momma Mia Catering
- Instagram: @momma_mia_caters
- Website: mommamiacaters.com`;

interface HistEntry { message: string; response: string; timestamp?: string }
interface ChatContext {
  conversationHistory?: HistEntry[];
  previousMessages?: string[];
  customerInfo?: Record<string, unknown>;
  quoteSent?: boolean;
  [k: string]: unknown;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

async function callGemini(history: HistEntry[], message: string): Promise<string> {
  // Gemini uses roles "user" / "model" (not "assistant"); map the replayed turns.
  const contents: unknown[] = [];
  for (const h of history) {
    contents.push({ role: "user", parts: [{ text: h.message }] });
    contents.push({ role: "model", parts: [{ text: h.response }] });
  }
  contents.push({ role: "user", parts: [{ text: message }] });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
          // 2.5 models "think" by default, which would consume the token budget
          // before emitting the visible reply — disable it for this short,
          // latency-sensitive conversational task.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: { text?: string }) => p.text ?? "").join("").trim();
}

// Persist a completed lead. Never throws — a save failure must not break the
// chat reply (the customer still gets their confirmation message).
async function saveQuote(row: Record<string, unknown>): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.warn("chat: service role/URL unset — cannot persist quote lead");
    return;
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/quote_requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) console.error(`chat: quote insert ${r.status}: ${await r.text()}`);
  } catch (e) {
    console.error("chat: quote insert failed:", e instanceof Error ? e.message : e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  if (!GEMINI_API_KEY) {
    console.error("chat: GEMINI_API_KEY not set — refusing to call the model");
    return json({
      response: "Our chat assistant is taking a quick break. Please email mommamiacaters@gmail.com and we'll help you right away!",
      status: "error",
    });
  }

  let body: { message?: string; context?: ChatContext; timestamp?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const message = (body.message ?? "").toString().slice(0, MAX_MESSAGE_CHARS).trim();
  if (!message) return json({ error: "empty message" }, 400);
  const ctx: ChatContext = body.context ?? {};
  const historyWindow = (ctx.conversationHistory ?? []).slice(-MAX_HISTORY_TURNS);

  // 1) LLM reply
  let aiResponse: string;
  try {
    aiResponse = await callGemini(historyWindow, message);
    if (!aiResponse) {
      aiResponse = "Sorry, I had trouble understanding that. Could you try asking again?";
    }
  } catch (e) {
    console.error("chat: gemini failed:", e instanceof Error ? e.message : e);
    return json({
      response: "Oops! I'm having trouble right now. Please try again in a moment, or email mommamiacaters@gmail.com.",
      status: "error",
    });
  }

  // 2) Extract + strip the hidden [QUOTE_DATA] tag the model is told to emit.
  let quoteData: Record<string, string> | null = null;
  const tag = aiResponse.match(/\[QUOTE_DATA\]([\s\S]*?)\[\/QUOTE_DATA\]/);
  if (tag) {
    try { quoteData = JSON.parse(tag[1]); } catch { /* ignore malformed tag */ }
    aiResponse = aiResponse.replace(/\s*\[QUOTE_DATA\][\s\S]*?\[\/QUOTE_DATA\]\s*/, "").trim();
  }

  const now = new Date().toISOString();
  const conversationHistory: HistEntry[] = [
    ...(ctx.conversationHistory ?? []),
    { message, response: aiResponse, timestamp: now },
  ];
  const previousMessages: string[] = [...(ctx.previousMessages ?? []), message];

  // 3) Intents (ported regex rules)
  const msgLower = message.toLowerCase();
  const intents: string[] = [];
  if (/quote|price|cost|how much|estimate/i.test(msgLower)) intents.push("pricing");
  if (/order|book|reserve|event|pax|people|guests/i.test(msgLower)) intents.push("order");
  if (/service|offer|menu|lunch|tray|cater/i.test(msgLower)) intents.push("services");
  if (intents.length === 0) intents.push("general");

  // 4) Fallback: if the model didn't emit the tag, sniff an email + a few fields
  // from the transcript once the conversation is clearly a quote flow.
  if (!quoteData) {
    let detected: string | null = null;
    for (const msg of previousMessages) {
      const mm = msg.match(EMAIL_RE);
      if (mm) { detected = mm[0]; break; }
    }
    if (detected && conversationHistory.length >= 4) {
      const allText = previousMessages.join(" ");
      const pax = allText.match(/(\d+)\s*(pax|people|guests|persons?)/i);
      const name = allText.match(/(?:my name is|i'm|i am)\s+([a-zA-Z]+)/i);
      quoteData = {
        name: name ? name[1] : "",
        email: detected,
        eventType: "",
        pax: pax ? pax[1] : "",
        eventDate: "",
        orderRequest: conversationHistory[conversationHistory.length - 1].response,
      };
    }
  }

  // Lead score (ported)
  let score = 0;
  if (intents.includes("order") || intents.includes("pricing")) score += 30;
  if (quoteData?.email) score += 30;
  if (conversationHistory.length >= 3) score += 10;
  const level = score >= 50 ? "hot" : score >= 20 ? "warm" : "cold";
  const priority = level === "hot" ? "high" : level === "warm" ? "medium" : "low";

  // 5) Persist a completed lead → the AFTER INSERT trigger emails the owner.
  // Require a well-formed email (anchored, not the loose "contains an address"
  // sniffer used above) so a model hallucination / crafted context can't insert
  // a junk lead. NOTE: the per-minute email throttle lives in _quote_notify_post;
  // bounding LLM/DB abuse on this public endpoint fully needs a rate-limit /
  // Turnstile token — tracked as a follow-up.
  const isValidEmail = (s?: string): s is string => !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  let quoteSent = false;
  if (quoteData && isValidEmail(quoteData.email)) {
    const orderRequest = quoteData.orderRequest && quoteData.orderRequest.trim()
      ? quoteData.orderRequest
      : conversationHistory.map((h) => `Customer: ${h.message}\nBot: ${h.response}`).join("\n---\n");
    await saveQuote({
      name: quoteData.name || null,
      email: quoteData.email,
      event_type: quoteData.eventType || null,
      pax: quoteData.pax || null,
      event_date: quoteData.eventDate || null,
      order_request: orderRequest,
      intents,
      lead_score: score,
      lead_level: level,
      lead_priority: priority,
      conversation: conversationHistory,
    });
    quoteSent = true;
  }

  return json({
    response: aiResponse,
    timestamp: now,
    status: "success",
    intents,
    leadScore: { score, level, priority, reasoning: `Score ${score} from intents: ${intents.join(", ")}` },
    context: {
      customerInfo: {
        ...(ctx.customerInfo ?? {}),
        email: quoteData?.email ?? null,
        urgency: score >= 50 ? "high" : "normal",
      },
      previousMessages,
      leadScore: { score, level, priority },
      lastIntents: intents,
      conversationHistory,
      // The widget re-shows its quick-reply buttons when this flips true.
      quoteSent,
    },
  });
});
