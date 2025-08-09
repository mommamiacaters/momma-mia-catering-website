import React, { useEffect, useRef, useState } from "react";
import Image from "../Image/Image";

interface CarouselProps {
  images: string[];
  title: string;
  onPreview?: (url: string) => void;
}

const Carousel: React.FC<CarouselProps> = ({ images, title, onPreview }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const draggedRef = useRef(false);

  const clamp = (i: number) => Math.max(0, Math.min(images.length - 1, i));

  const goTo = (i: number) => {
    const next = clamp(i);
    setIndex(next);
    const track = trackRef.current;
    if (track) {
      const slide = track.children[next] as HTMLElement | undefined;
      if (slide) track.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
    }
  };

  const prev = () => goTo(index - 1);
  const next = () => goTo(index + 1);

  // Sync index on manual scroll
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
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
      if (nearest !== index) setIndex(clamp(nearest));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll as any);
  }, [index, images.length]);

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
  }, []);

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
              className="group relative overflow-hidden shadow-lg cursor-pointer h-[45vh] md:h-[55vh] lg:h-[65vh] xl:h-[70vh]"
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
                onPreview?.(src);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPreview?.(src);
                }
              }}
            >
              <Image src={src} alt={`${title} ${i + 1}`} className="w-full h-full object-contain bg-brand-primary" />
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
            className={`h-2 w-2 rounded-full ${i === index ? "bg-brand-primary" : "bg-brand-divider"}`}
            onClick={() => goTo(i)}
          />)
        )}
      </div>
    </div>
  );
};

export default Carousel;
