import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface CarouselProps {
  images: string[];
  title: string;
  /** Auto-advance interval in ms. 0 = disabled. Default 5000. */
  autoPlay?: number;
}

const Carousel: React.FC<CarouselProps> = ({ images, title, autoPlay = 5000 }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadedSet, setLoadedSet] = useState<Set<number>>(() => new Set([0]));
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const draggedRef = useRef(false);
  const indexRef = useRef(0);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  const total = images.length;

  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(total - 1, i)),
    [total]
  );

  // Mark adjacent slides for eager loading
  const markLoaded = useCallback(
    (i: number) => {
      setLoadedSet((prev) => {
        const next = new Set(prev);
        // Current, prev, and next slides
        for (const offset of [-1, 0, 1]) {
          const idx = clamp(i + offset);
          next.add(idx);
        }
        return next.size === prev.size ? prev : next;
      });
    },
    [clamp]
  );

  const goTo = useCallback(
    (i: number) => {
      const next = clamp(i);
      indexRef.current = next;
      setIndex(next);
      markLoaded(next);
      const track = trackRef.current;
      if (track) {
        const slide = track.children[next] as HTMLElement | undefined;
        if (slide) track.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
      }
    },
    [clamp, markLoaded]
  );

  const goPrev = () => goTo(indexRef.current - 1);
  const goNext = () => goTo(indexRef.current + 1);

  // ─── Auto-play ───
  const startAutoPlay = useCallback(() => {
    if (!autoPlay || total <= 1) return;
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    autoPlayRef.current = setInterval(() => {
      if (pausedRef.current) return;
      const next = indexRef.current + 1;
      if (next >= total) {
        // Loop back to first
        goTo(0);
      } else {
        goTo(next);
      }
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

  // ─── IntersectionObserver for dot sync ───
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const slideIndex = Array.from(el.children).indexOf(entry.target as HTMLElement);
            if (slideIndex >= 0 && slideIndex !== indexRef.current) {
              indexRef.current = slideIndex;
              setIndex(slideIndex);
              markLoaded(slideIndex);
            }
          }
        }
      },
      { root: el, threshold: 0.5 }
    );

    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [total, markLoaded]);

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
      // Snap to nearest slide on release
      let nearest = 0;
      let minDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i] as HTMLElement;
        const dist = Math.abs(el.scrollLeft - child.offsetLeft);
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

      {/* Track */}
      <div
        ref={trackRef}
        className={`carousel-track flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-0 select-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        aria-roledescription="carousel"
        aria-label={`${title} images`}
      >
        {images.map((src, i) => {
          const shouldLoad = loadedSet.has(i);
          return (
            <div key={i} className="snap-start shrink-0 w-full">
              <div
                className="relative overflow-hidden bg-brand-secondary h-[35vh] md:h-[40vh] lg:h-[45vh] xl:h-[50vh] max-h-[500px]"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${total}`}
              >
                {shouldLoad ? (
                  <img
                    src={src}
                    alt={`${title} ${i + 1}`}
                    className="w-full h-full object-cover carousel-img-loaded"
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding={i === 0 ? "sync" : "async"}
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
                  tabIndex={i === index ? 0 : -1}
                  role="button"
                  aria-label={`View ${title} image ${i + 1} fullscreen`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation arrows — appear on hover */}
      {total > 1 && (
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
          <button
            type="button"
            className={`pointer-events-auto ml-3 sm:ml-5 rounded-full bg-white/90 hover:bg-white text-brand-text w-10 h-10 shadow-lg flex items-center justify-center transition-all duration-300 ${
              index === 0
                ? "opacity-0 pointer-events-none"
                : "opacity-0 group-hover/carousel:opacity-100"
            }`}
            aria-label="Previous image"
            onClick={goPrev}
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className={`pointer-events-auto mr-3 sm:mr-5 rounded-full bg-white/90 hover:bg-white text-brand-text w-10 h-10 shadow-lg flex items-center justify-center transition-all duration-300 ${
              index === total - 1
                ? "opacity-0 pointer-events-none"
                : "opacity-0 group-hover/carousel:opacity-100"
            }`}
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
                  i === index
                    ? "bg-brand-primary w-6 h-2"
                    : "bg-brand-divider hover:bg-brand-primary/40 w-2 h-2"
                }`}
                onClick={() => goTo(i)}
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
