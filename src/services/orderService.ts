import type { OrderSubmission } from "../types";

const getWebhookUrl = () => {
  const base = import.meta.env.VITE_N8N_BASE_URL || import.meta.env.VITE_N8N_LOCAL;
  return `${base}/webhook/checkout`;
};

export async function submitOrder(data: OrderSubmission): Promise<void> {
  const response = await fetch(getWebhookUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to submit order");
}
