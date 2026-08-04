import type { ReactNode } from "react";

interface PageTransitionProps {
  /**
   * Changing this remounts the subtree, which replays the enter animation.
   * Pass a *route group* (not always the full pathname) when the surrounding
   * chrome should survive the change — e.g. the admin shell keeps its sidebar
   * while only the content pane crossfades.
   */
  transitionKey: string;
  children: ReactNode;
}

/**
 * 200ms fade + 4px rise on navigation.
 *
 * The animation is applied through Tailwind's `motion-safe:` variant, which
 * compiles to `@media (prefers-reduced-motion: no-preference)` — so users who
 * ask their OS to reduce motion get an instant swap with no JS media query and
 * no flash of an un-animated frame.
 */
export function PageTransition({ transitionKey, children }: PageTransitionProps) {
  return (
    <div key={transitionKey} className="motion-safe:animate-page-in">
      {children}
    </div>
  );
}
