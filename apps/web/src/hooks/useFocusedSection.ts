import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Which of several stacked sections the reader is currently on.
 *
 * Not "the most visible one": these panels are shorter than the screen, so near
 * the top of the page two of them are BOTH fully on screen with an intersection
 * ratio of exactly 1. Comparing ratios picks between them arbitrarily, which is
 * how Check-a-Lunch ended up closed while a lower panel was open at scroll
 * position zero.
 *
 * So the observer is only a trigger. The decision is made from live geometry:
 * whichever panel sits under an imaginary reading line near the top of the
 * viewport wins, and if none does, the nearest one to it does. That is stable
 * regardless of which records the browser batches into a callback, and it keeps
 * the last panel selected once you scroll past the bottom of the stack.
 *
 * A scroll listener would be the obvious way to do this and the wrong one: it
 * runs on every frame. The observer fires only on threshold crossings.
 */

/** How far down the viewport the reading line sits. */
const READING_LINE = 0.35;

/** ~5% steps, so a crossing fires every few dozen pixels of scroll. */
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

export function useFocusedSection<T extends HTMLElement>(enabled = true) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const nodes = useRef(new Map<string, T>());
  const callbacks = useRef(new Map<string, (el: T | null) => void>());
  const [generation, setGeneration] = useState(0);

  /**
   * Ref callback per key, cached so its identity is stable across renders. A
   * fresh function each render would make React detach and re-attach the ref
   * every time, and each re-register would bump `generation` and render again.
   */
  const register = useCallback((key: string) => {
    let cb = callbacks.current.get(key);
    if (!cb) {
      cb = (el: T | null) => {
        if (el) nodes.current.set(key, el);
        else nodes.current.delete(key);
        setGeneration((g) => g + 1);
      };
      callbacks.current.set(key, cb);
    }
    return cb;
  }, []);

  useEffect(() => {
    if (!enabled) {
      setActiveKey(null);
      return;
    }
    const entries = [...nodes.current.entries()];
    if (entries.length === 0) return;

    const decide = () => {
      const line = window.innerHeight * READING_LINE;
      let best: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      // Map order follows the DOM, so an exact tie keeps the higher panel and
      // the hand-over always runs down the page.
      for (const [key, el] of nodes.current) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        const distance =
          rect.top > line ? rect.top - line : rect.bottom < line ? line - rect.bottom : 0;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = key;
        }
      }
      if (best) setActiveKey(best);
    };

    const io = new IntersectionObserver(decide, { threshold: THRESHOLDS });
    entries.forEach(([, el]) => io.observe(el));
    window.addEventListener("resize", decide);
    decide();
    return () => {
      io.disconnect();
      window.removeEventListener("resize", decide);
    };
  }, [enabled, generation]);

  return { activeKey, register };
}
