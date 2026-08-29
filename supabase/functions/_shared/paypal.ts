// Shared PayPal REST helpers for the checkout Edge Functions.
// -----------------------------------------------------------------------------
// One place for the credentials, the environment switch and the money maths, so
// paypal-create-order, paypal-capture-order and paypal-webhook cannot drift
// apart on any of the three.
//
// Secrets (set via the Management API):
//   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET                  – LIVE app
//   PAYPAL_SANDBOX_CLIENT_ID / PAYPAL_SANDBOX_CLIENT_SECRET  – sandbox app
//   PAYPAL_SANDBOX_TEST_KEY  – gates the -sandbox slugs (local testing only)
//   PAYPAL_WEBHOOK_ID        – from the webhook you register (webhook fn only)
// -----------------------------------------------------------------------------

/**
 * Which PayPal to talk to. The mode is HARDCODED per deployed function slug
 * (paypal-create-order = live, paypal-create-order-sandbox = sandbox), never
 * taken from the request: a caller who could pick "sandbox" against the live
 * site could mark a real order paid with sandbox play-money.
 */
export type PayPalMode = "live" | "sandbox";

export interface PayPalConfig {
  mode: PayPalMode;
  api: string;
  clientId: string;
  clientSecret: string;
}

export function getPayPalConfig(mode: PayPalMode): PayPalConfig {
  const prefix = mode === "sandbox" ? "PAYPAL_SANDBOX" : "PAYPAL";
  return {
    mode,
    api: mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
    clientId: Deno.env.get(`${prefix}_CLIENT_ID`) ?? "",
    clientSecret: Deno.env.get(`${prefix}_CLIENT_SECRET`) ?? "",
  };
}

/** PH PayPal business accounts settle in PHP, which is what the catalogue is in. */
export const CURRENCY = "PHP";

export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sandbox-key",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

export function assertConfigured(cfg: PayPalConfig): void {
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error(`PayPal ${cfg.mode} is not configured: set the client id/secret secrets`);
  }
}

/**
 * Centavos to the decimal string PayPal wants. Integer maths the whole way —
 * `(cents / 100).toFixed(2)` goes wrong on values like 1_00_000_000 / 3 and
 * there is no reason to invite floating point anywhere near money.
 */
export function centsToAmount(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** The inverse, used to check what PayPal says it captured. */
export function amountToCents(amount: string): number {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!m) throw new Error(`Unparseable PayPal amount: ${amount}`);
  const [, sign, whole, frac = "0"] = m;
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return sign === "-" ? -cents : cents;
}

/**
 * Client-credentials access token. Deliberately not cached across invocations:
 * Edge workers are short-lived and recycled unpredictably, so a module-level
 * cache buys little and risks serving a token that expired mid-request.
 */
export async function getAccessToken(cfg: PayPalConfig): Promise<string> {
  assertConfigured(cfg);
  const res = await fetch(`${cfg.api}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${cfg.clientId}:${cfg.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await res.text();
  if (!res.ok) {
    // Never echo the body to the caller — it can carry account detail.
    console.error("PayPal token failed:", res.status, body);
    throw new Error("Could not authenticate with PayPal");
  }
  return JSON.parse(body).access_token as string;
}

export async function paypalFetch(
  cfg: PayPalConfig,
  token: string,
  path: string,
  init: RequestInit & { requestId?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { requestId, ...rest } = init;
  const res = await fetch(`${cfg.api}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Makes a retried capture return the FIRST result instead of charging
      // again. The single most important header in this file.
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      ...(rest.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

/** Service-role Supabase REST call. Used to reach the SECURITY DEFINER RPCs. */
export async function rpc<T = unknown>(
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`rpc ${fn} failed:`, res.status, text);
    throw new Error(`rpc ${fn} failed: ${text}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/** Read a single order row with the service role. */
export async function getOrder(
  match: { id?: string; paypal_order_id?: string },
  select = "id,order_ref,total_cents,payment_status,paypal_order_id,customer_email",
): Promise<Record<string, unknown> | null> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const [col, val] = match.id ? ["id", match.id] : ["paypal_order_id", match.paypal_order_id!];
  const res = await fetch(
    `${url}/rest/v1/orders?${col}=eq.${encodeURIComponent(val)}&select=${select}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    console.error("order lookup failed:", res.status, await res.text());
    throw new Error("Order lookup failed");
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows[0] ?? null;
}
