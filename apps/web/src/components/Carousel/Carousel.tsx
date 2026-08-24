import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface CarouselProps {
  images: string[];
  title: string;
  /** Per-image alt text, positional. Blank/missing entries fall back to the title. */
  alts?: (string | null)[];
  /** Auto-advance interval in ms. 0 = disabled. Default 5000. */
  autoPlay?: number;
}

/**
 * Cloned slides on each side of the real set. Two is enough to fill the widest
 * realistic viewport beside a centred slide; the settle handler re-anchors to
 * the real copy before anyone can scroll past them.
 */
const CLONE_PAD = 2;

/**
 * Looping filmstrip: the active photo sits centred at its own size, and the
 * strip runs edge to edge with the neighbouring photos (repeating A, B, A, B
 * for a two-photo set) instead of leaving empty margins. The loop is clones +
 * an instant re-anchor once scrolling settles: the copy under the viewport is
 * pixel-identical to the real slide, so the jump cannot be seen.
 */
const Carousel: React.FC<CarouselProps> = ({ images, title, alts, autoPlay = 5000 }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Index into the EXTENDED strip (clones + real). The real photo number the
  // dots and labels speak is realOf(index).
  const [index, setIndex] = useState(CLONE_PAD);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadedSet, setLoadedSet] = useState<Set<number>>(() => new Set([0]));
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const draggedRef = useRef(false);
  const indexRef = useRef(CLONE_PAD);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  const total = images.length;
  const extTotal = total > 0 ? total + CLONE_PAD * 2 : 0;

  /** Real image index for a position in the extended strip. */
  const realOf = useCallback(
    (ext: number) => (total > 0 ? (((ext - CLONE_PAD) % total) + total) % total : 0),
    [total]
  );

  const clampExt = useCallback(
    (i: number) => Math.max(0, Math.min(extTotal - 1, i)),
    [extTotal]
  );

  // Mark a real image and its neighbours (wrapping) for eager loading.
  const markLoaded = useCallback(
    (real: number) => {
      setLoadedSet((prev) => {
        if (total === 0) return prev;
        const next = new Set(prev);
        for (const offset of [-1, 0, 1]) {
          next.add((((real + offset) % total) + total) % total);
        }
        return next.size === prev.size ? prev : next;
      });
    },
    [total]
  );

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Scroll position that centres a slide in the track. */
  const centerLeft = (track: HTMLElement, slide: HTMLElement) =>
    slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;

  const goTo = useCallback(
    (i: number) => {
      const next = clampExt(i);
      indexRef.current = next;
      setIndex(next);
      markLoaded(realOf(next));
      const track = trackRef.current;
      if (track) {
        const slide = track.children[next] as HTMLElement | undefined;
        if (slide) {
          track.scrollTo({
            left: centerLeft(track, slide),
            behavior: prefersReducedMotion() ? "auto" : "smooth",
          });
        }
      }
    },
    [clampExt, markLoaded, realOf]
  );

  // Manual navigation restarts the auto-play clock (startAutoPlay clears the
  // old interval), so a tick can never fire right on the heels of a click and
  // double-advance the strip.
  const goPrev = () => { goTo(indexRef.current - 1); startAutoPlay(); };
  const goNext = () => { goTo(indexRef.current + 1); startAutoPlay(); };

  // ─── Auto-play ───
  const startAutoPlay = useCallback(() => {
    if (!autoPlay || total <= 1) return;
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    autoPlayRef.current = setInterval(() => {
      if (pausedRef.current) return;
      // Always forward — the loop re-anchor makes the wrap seamless, so there
      // is no long rewind back to the first slide any more.
      goTo(indexRef.current + 1);
    }, autoPlay);
  }, [autoPlay, total, goTo]);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoPlay();
    return stopAutoPlay;
  }, [startAutoPlay, stopAutoPlay]);

  // Pause on hover
  const onMouseEnter = () => { pausedRef.current = true; };
  const onMouseLeave = () => { pausedRef.current = false; };

  // ─── Keyboard navigation ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (previewUrl) {
        if (e.key === "Escape") setPreviewUrl(null);
        return;
      }
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  // ─── Initial position: anchor on the first REAL slide ───
  useEffect(() => {
    const track = trackRef.current;
    if (!track || total === 0) return;
    const slide = track.children[CLONE_PAD] as HTMLElement | undefined;
    if (slide) track.scrollTo({ left: centerLeft(track, slide) });
  }, [total]);

  // ─── Settle handler: dot sync + loop re-anchor ───
  // Nearest-to-centre beats an IntersectionObserver here: on a wide screen two
  // slides can both be fully visible (ratio 1.0), which makes ratio-based
  // picking arbitrary. Runs only after scrolling goes quiet, so the re-anchor
  // never happens under a moving finger.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || total === 0) return;
    let timer: number | null = null;

    const settle = () => {
      if (isDownRef.current) return; // drag release does its own snap
      const center = el.scrollLeft + el.clientWidth / 2;
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i] as HTMLElement;
        const dist = Math.abs(child.offsetLeft + child.offsetWidth / 2 - center);
        if (dist < best) { best = dist; nearest = i; }
      }
      if (nearest !== indexRef.current) {
        indexRef.current = nearest;
        setIndex(nearest);
        markLoaded(realOf(nearest));
      }
      // Settled on a clone — swap to the identical real slide, instantly.
      if (nearest < CLONE_PAD || nearest >= total + CLONE_PAD) {
        const home = CLONE_PAD + realOf(nearest);
        const slide = el.children[home] as HTMLElement | undefined;
        if (slide) {
          indexRef.current = home;
          setIndex(home);
          el.scrollTo({ left: centerLeft(el, slide), behavior: "auto" });
        }
      }
    };

    const onScroll = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(settle, 90);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [total, markLoaded, realOf]);

  // ─── Pointer drag-to-swipe ───
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      isDownRef.current = true;
      setDragging(true);
      draggedRef.current = false;
      startXRef.current = e.clientX;
      startScrollLeftRef.current = el.scrollLeft;
      el.setPointerCapture?.(e.pointerId);
      // Pause auto-play during drag
      pausedRef.current = true;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDownRef.current) return;
      const dx = e.clientX - startXRef.current;
      if (Math.abs(dx) > 5) draggedRef.current = true;
      el.scrollLeft = startScrollLeftRef.current - dx;
      e.preventDefault();
    };

    const endDrag = () => {
      if (!isDownRef.current) return;
      isDownRef.current = false;
      setDragging(false);
      pausedRef.current = false;
      // Snap to whichever slide is nearest the centre on release
      const center = el.scrollLeft + el.clientWidth / 2;
      let nearest = 0;
      let minDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i] as HTMLElement;
        const dist = Math.abs(child.offsetLeft + child.offsetWidth / 2 - center);
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      }
      goTo(nearest);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("pointerleave", endDrag);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove as EventListener);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("pointerleave", endDrag);
    };
  }, [goTo]);

  // Preload first image immediately
  useEffect(() => { markLoaded(0); }, [markLoaded]);

  if (!images?.length) return null;

  const realIndex = realOf(index);

  return (
    <div
      className="relative group/carousel"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Scoped styles */}
      <style>{`
        .carousel-track { -ms-overflow-style: none; scrollbar-width: none; }
        .carousel-track::-webkit-scrollbar { display: none; }
        @keyframes carousel-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .carousel-img-loaded { animation: carousel-fade-in 0.4s ease-out; }
      `}</style>

      {/* Track — no scroll-smooth class: smooth is passed explicitly in goTo,
          so the loop re-anchor's behavior:"auto" jump stays truly instant. */}
      <div
        ref={trackRef}
        className={`carousel-track flex overflow-x-auto snap-x snap-mandatory gap-3 sm:gap-4 select-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        aria-roledescription="carousel"
        aria-label={`${title} images`}
      >
        {Array.from({ length: extTotal }).map((_, ext) => {
          const real = realOf(ext);
          const isClone = ext < CLONE_PAD || ext >= total + CLONE_PAD;
          const src = images[real];
          const shouldLoad = loadedSet.has(real);
          return (
            <div
              key={ext}
              className="snap-center shrink-0 w-[86vw] sm:w-[74vw] md:w-[62vw] lg:w-[56rem]"
              aria-hidden={isClone || undefined}
            >
              <div
                className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-brand-secondary aspect-[3/2] max-h-[560px]"
                role={isClone ? undefined : "group"}
                aria-roledescription={isClone ? undefined : "slide"}
                aria-label={isClone ? undefined : `${real + 1} of ${total}`}
              >
                {shouldLoad ? (
                  <img
                    src={src}
                    alt={isClone ? "" : alts?.[real]?.trim() || `${title} ${real + 1}`}
                    className="w-full h-full object-cover carousel-img-loaded"
                    loading={real === 0 ? "eager" : "lazy"}
                    decoding={real === 0 && !isClone ? "sync" : "async"}
                    draggable={false}
                  />
                ) : (
                  // Skeleton placeholder until slide enters viewport range
                  <div className="w-full h-full bg-brand-divider/30 animate-pulse" />
                )}

                {/* Hover overlay */}
                <div
                  className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors duration-300 cursor-pointer"
                  onClick={(e) => {
                    if (draggedRef.current) {
                      e.stopPropagation();
                      draggedRef.current = false;
                      return;
                    }
                    setPreviewUrl(src);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPreviewUrl(src);
                    }
                  }}
                  tabIndex={!isClone && ext === index ? 0 : -1}
                  role={isClone ? undefined : "button"}
                  aria-label={
                    isClone ? undefined : `View ${title} image ${real + 1} fullscreen`
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation arrows — appear on hover. The strip loops, so neither
          direction ever runs out; both stay enabled. */}
      {total > 1 && (
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
          <button
            type="button"
            className="pointer-events-auto ml-3 sm:ml-5 rounded-full bg-white/90 hover:bg-white text-brand-text w-10 h-10 shadow-lg flex items-center justify-center transition-opacity duration-300 opacity-0 group-hover/carousel:opacity-100"
            aria-label="Previous image"
            onClick={goPrev}
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="pointer-events-auto mr-3 sm:mr-5 rounded-full bg-white/90 hover:bg-white text-brand-text w-10 h-10 shadow-lg flex items-center justify-center transition-opacity duration-300 opacity-0 group-hover/carousel:opacity-100"
            aria-label="Next image"
            onClick={goNext}
          >
            <ChevronRight size={20} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Bottom bar: dots + counter */}
      {total > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to image ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  i === realIndex
                    ? "bg-brand-primary w-6 h-2"
                    : "bg-brand-divider hover:bg-brand-primary/40 w-2 h-2"
                }`}
                onClick={() => { goTo(CLONE_PAD + i); startAutoPlay(); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="relative max-w-[95vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              type="button"
              aria-label="Close preview"
              className="absolute -top-3 -right-3 bg-white hover:bg-brand-secondary text-brand-text rounded-full w-10 h-10 shadow-lg flex items-center justify-center transition-colors"
              onClick={() => setPreviewUrl(null)}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Carousel;
