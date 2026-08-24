import { useEffect, useState } from "react";

/**
 * Mount gate for expensive overlay content. True while `open`, and for
 * `exitMs` after it closes so the exit animation still has content to show.
 * The overlay's shell (backdrop, panel, transition classes) stays driven by
 * `open` as before — only the heavy children should be gated on this.
 */
export function usePresence(open: boolean, exitMs: number): boolean {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);
  return open || mounted;
}
