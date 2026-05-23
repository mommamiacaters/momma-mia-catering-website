// Rate limiter — 60s cooldown between order submissions
// Uses sessionStorage so it resets on tab close (intentional UX choice)

const STORAGE_KEY = "mm_last_order_submit";
const COOLDOWN_SECONDS = 60;

export function canSubmitOrder(): boolean {
  const last = sessionStorage.getItem(STORAGE_KEY);
  if (!last) return true;
  return Date.now() - Number(last) >= COOLDOWN_SECONDS * 1000;
}

export function recordSubmission(): void {
  sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
}

export function getSecondsUntilNext(): number {
  const last = sessionStorage.getItem(STORAGE_KEY);
  if (!last) return 0;
  const elapsed = (Date.now() - Number(last)) / 1000;
  return Math.max(0, Math.ceil(COOLDOWN_SECONDS - elapsed));
}
