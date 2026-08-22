// Storefront read of the admin-managed carousel photos for one service page.
//
// It reports slides ONLY on a successful, non-empty response. Loading, a failed
// request and "the admin has not uploaded anything yet" all resolve to an empty
// array, which is the caller's signal to render no carousel — these pages have
// no bundled photos behind them.
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

/** Decodes an image off-screen. false = the URL is broken or won't decode. */
async function canDecode(src: string): Promise<boolean> {
  const img = new Image();
  img.src = src;
  return img.decode().then(
    () => true,
    () => false,
  );
}

export function useCarouselImages(slug: string): CarouselSlide[] {
  const [state, setState] = useState<SlideState>({ slug: "", slides: EMPTY });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    listCarouselImages(slug)
      .then(async (rows) => {
        if (cancelled) return;
        const candidates = rows.map((row) => ({ src: row.image_url, alt: row.alt_text }));
        // Decode everything off-screen and drop what won't paint: a row whose
        // stored file is missing or corrupt must never surface as a blank
        // slide.
        const decodable = await Promise.all(candidates.map((s) => canDecode(s.src)));
        if (cancelled) return;
        const slides = candidates.filter((_, i) => decodable[i]);
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
