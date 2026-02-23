import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "../Image/Image";

interface CarouselProps {
  images: string[];
  title: string;
}

const Carousel: React.FC<CarouselProps> = ({ images, title }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const draggedRef = useRef(false);
  const indexRef = useRef(0);

  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(images.length - 1, i)),
    [images.length]
  );

  const goTo = useCallback(
    (i: number) => {
      const next = clamp(i);
      indexRef.current = next;
      setIndex(next);
      const track = trackRef.current;
      if (track) {
        const slide = track.children[next] as HTMLElement | undefined;
        if (slide) track.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
      }
    },
    [clamp]
  );

  const prev = () => goTo(indexRef.current - 1);
  const next = () => goTo(indexRef.current + 1);

  // Close preview on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Sync dot indicator on scroll — uses IntersectionObserver for instant updates
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
            }
          }
        }
      },
      { root: el, threshold: 0.5 }
    );

    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [images.length]);

  // Pointer events for drag-to-swipe (mouse and touch)
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
      el.removeEventListener("pointermove", onPointerMove as any);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("pointerleave", endDrag);
    };
  }, [goTo]);

  if (!images?.length) return null;

  return (
    <div className="relative">
      {/* Scoped styles to hide scrollbar on the track */}
      <style>{`
        .carousel-track { -ms-overflow-style: none; scrollbar-width: none; }
        .carousel-track::-webkit-scrollbar { display: none; }
      `}</style>
      {/* Track */}
      <div
        ref={trackRef}
        className={`carousel-track flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-0 select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        aria-roledescription="carousel"
        aria-label={`${title} images`}
      >
        {images.map((src, i) => (
          <div
            key={i}
            className="snap-start shrink-0 w-full"
          >
            <div
              className="group relative overflow-hidden shadow-lg cursor-pointer h-[35vh] md:h-[40vh] lg:h-[45vh] xl:h-[50vh] max-h-[500px]"
              role="button"
              tabIndex={0}
              aria-label={`Preview ${title} image ${i + 1}`}
              onClick={(e) => {
                if (draggedRef.current) {
                  // prevent opening preview after drag
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
            >
              <Image src={src} alt={`${title} ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
        <button
          type="button"
          className="pointer-events-auto ml-2 sm:ml-4 rounded-full bg-white/90 hover:bg-white text-brand-text w-9 h-9 shadow flex items-center justify-center disabled:opacity-50"
          aria-label="Previous image"
          onClick={prev}
          disabled={index === 0}
        >
          ←
        </button>
        <button
          type="button"
          className="pointer-events-auto mr-2 sm:mr-4 rounded-full bg-white/90 hover:bg-white text-brand-text w-9 h-9 shadow flex items-center justify-center disabled:opacity-50"
          aria-label="Next image"
          onClick={next}
          disabled={index === images.length - 1}
        >
          →
        </button>
      </div>

      {/* Dots */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to image ${i + 1}`}
            className={`rounded-full transition-all duration-200 ${i === index ? "bg-brand-primary w-3 h-3" : "bg-brand-divider w-2 h-2"}`}
            onClick={() => goTo(i)}
          />)
        )}
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl(null)}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="relative max-w-[95vw] max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl"
            />
            <button
              type="button"
              aria-label="Close preview"
              className="absolute -top-3 -right-3 bg-white/90 hover:bg-white text-brand-text rounded-full w-9 h-9 shadow flex items-center justify-center"
              onClick={() => setPreviewUrl(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Carousel;
