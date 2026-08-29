// PayPal JS SDK loader.
// -----------------------------------------------------------------------------
// The SDK is a single global script that can only be loaded once per page with
// one set of parameters, so this module owns the tag and hands everyone the
// same promise. React 18 StrictMode double-invokes effects in development,
// which without this would inject the script twice and leave two `window.paypal`
// globals racing each other.
//
// The client ID is PUBLIC by design — it identifies the merchant to PayPal and
// nothing more. The SECRET never leaves the Edge Functions.
// -----------------------------------------------------------------------------

/** Minimal shape of what we actually call. */
export interface PayPalButtonsConfig {
  style?: {
    layout?: "vertical" | "horizontal";
    color?: "gold" | "blue" | "silver" | "white" | "black";
    shape?: "rect" | "pill";
    label?: "paypal" | "checkout" | "buynow" | "pay";
    height?: number;
  };
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onCancel?: () => void;
  onError?: (err: unknown) => void;
}

export interface PayPalButtonsInstance {
  render: (target: HTMLElement) => Promise<void>;
  close: () => Promise<void>;
  isEligible?: () => boolean;
}

interface PayPalNamespace {
  Buttons: (config: PayPalButtonsConfig) => PayPalButtonsInstance;
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

export const PAYPAL_CLIENT_ID = (import.meta.env.VITE_PAYPAL_CLIENT_ID as string) || "";

/**
 * "sandbox" routes the checkout at the -sandbox Edge Functions and expects a
 * sandbox client id above. Set ONLY in a developer's local .env — the deploy
 * workflow pins the live values, so the public site can never flip modes.
 */
export const PAYPAL_MODE: "live" | "sandbox" =
  (import.meta.env.VITE_PAYPAL_ENV as string) === "sandbox" ? "sandbox" : "live";

/** Unlocks the -sandbox Edge Functions; local .env only, never committed. */
export const PAYPAL_SANDBOX_KEY = (import.meta.env.VITE_PAYPAL_SANDBOX_KEY as string) || "";

/** PH merchant accounts settle in PHP, and the catalogue is priced in PHP. */
const CURRENCY = "PHP";

let loader: Promise<PayPalNamespace> | null = null;

export function loadPayPal(): Promise<PayPalNamespace> {
  if (loader) return loader;

  loader = new Promise<PayPalNamespace>((resolve, reject) => {
    if (!PAYPAL_CLIENT_ID) {
      reject(new Error("VITE_PAYPAL_CLIENT_ID is not set"));
      return;
    }
    if (window.paypal) {
      resolve(window.paypal);
      return;
    }

    const params = new URLSearchParams({
      "client-id": PAYPAL_CLIENT_ID,
      currency: CURRENCY,
      intent: "capture",
      components: "buttons",
      // Nothing is shipped by PayPal and we take the address ourselves, so the
      // buyer is never asked for one twice.
      "disable-funding": "paylater",
    });

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.onload = () => {
      if (window.paypal) resolve(window.paypal);
      else reject(new Error("PayPal SDK loaded but exposed no global"));
    };
    script.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever —
      // this is usually a flaky network, not a permanent condition.
      loader = null;
      reject(new Error("Could not load the PayPal SDK"));
    };
    document.head.appendChild(script);
  });

  return loader;
}
