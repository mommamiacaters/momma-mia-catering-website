-- ============================================================================
-- Remove dead n8n_* app_settings rows
-- ----------------------------------------------------------------------------
-- order-notify was repointed off n8n to the Edge Function in 20260525092100
-- (n8n_webhook_url / n8n_checkout_token → order_notify_url / order_notify_secret),
-- and the chatbot + contact form move off n8n in 20260627090000. Nothing reads
-- the n8n_* keys anymore; drop them so they can't mislead an operator or get
-- accidentally re-wired. Idempotent (no-op if already absent).
-- ============================================================================

delete from public.app_settings
 where key in ('n8n_webhook_url', 'n8n_checkout_token');
