// Thin slug wrapper — the real logic lives in _shared/checkout-handlers.ts.
// Mode is fixed here at deploy time; see that file for why it must never come
// from the request.
import { createOrderHandler } from "../_shared/checkout-handlers.ts";

Deno.serve(createOrderHandler("sandbox"));
