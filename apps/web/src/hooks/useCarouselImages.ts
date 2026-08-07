// Storefront read of the admin-managed carousel photos for one service page.
//
// It reports slides ONLY on a successful, non-empty response. Loading, a failed
// request and "the admin has not uploaded anything yet" all resolve to an empty
// array, which is the caller's signal to keep rendering the bundled images —
// a broken fetch must never blank out the carousel.
import { useEffect, useState } from "react";
import { listCarouselImages } from "../services/carouselService";

export interface CarouselSlide {
  src: string;
  alt: string | null;
}

interface SlideState {
  slug: string;
  slides: CarouselSlide[];
}

const EMPTY: CarouselSlide[] = [];

/** Decodes an image off-screen; a photo that won't decode never blocks the swap. */
async function preload(src: string): Promise<void> {
  const img = new Image();
  img.src = src;
  await img.decode().catch(() => undefined);
}

export function useCarouselImages(slug: string): CarouselSlide[] {
  const [state, setState] = useState<SlideState>({ slug: "", slides: EMPTY });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    listCarouselImages(slug)
      .then(async (rows) => {
        if (cancelled) return;
        const slides = rows.map((row) => ({ src: row.image_url, alt: row.alt_text }));
        // Hold the bundled photos on screen until the first replacement can
        // paint, otherwise the swap flashes an empty hero while it downloads.
        if (slides.length > 0) await preload(slides[0].src);
        if (cancelled) return;
        setState({ slug, slides });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load carousel images", err);
        setState({ slug, slides: EMPTY });
      });

    // A slug change while a request is in flight discards the late answer.
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Slides from a previous slug never leak into the current page.
  return state.slug === slug ? state.slides : EMPTY;
}
