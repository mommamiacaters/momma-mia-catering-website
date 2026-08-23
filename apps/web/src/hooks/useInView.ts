import { useEffect, useRef, useState } from "react";

/**
 * True once the element has scrolled into view, and true forever after.
 *
 * IntersectionObserver rather than a scroll listener: the callback fires only
 * when the element crosses the threshold instead of on every frame, and it
 * costs nothing while the element is off screen.
 */
export function useInView<T extends Element>(rootMargin = "0px 0px -15% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    // No observer (very old browser, SSR snapshot): show the content rather
    // than leaving it stuck at its hidden starting state.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setInView(true);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, inView]);

  return { ref, inView };
}
