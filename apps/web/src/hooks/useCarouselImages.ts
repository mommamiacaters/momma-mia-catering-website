// Storefront read of the admin-managed carousel photos for one service page.
//
// Slides are published the moment the ROWS arrive — the carousel renders
// immediately with per-slide skeletons and each photo pops in as it loads.
// Broken files are weeded out with a HEAD request per URL (headers only, no
// image bytes): a missing file or a format browsers can't paint (HEIC) is
// pruned. A file that passes but still fails to load is pruned by `prune`,
// which the carousel calls from the slide's own <img> error.
import { useCallback, useEffect, useState } from "react";
import { listCarouselImages, type CarouselImage } from "../services/carouselService";

export interface CarouselSlide {
  src: string;
  alt: string | null;
}

interface SlideState {
  slug: string;
  slides: CarouselSlide[];
  loading: boolean;
}

const EMPTY: CarouselSlide[] = [];

/** Rows per service for 5 minutes, so going back to a page doesn't refetch them. */
const ROWS_TTL_MS = 5 * 60 * 1000;
const rowsCache = new Map<string, { at: number; rows: CarouselImage[] }>();

/** Drop cached rows. Call after an admin carousel edit. */
export function invalidateCarouselImages(): void {
  rowsCache.clear();
}

function loadRows(slug: string): Promise<CarouselImage[]> {
  const hit = rowsCache.get(slug);
  if (hit && Date.now() - hit.at < ROWS_TTL_MS) return Promise.resolve(hit.rows);
  return listCarouselImages(slug).then((rows) => {
    rowsCache.set(slug, { at: Date.now(), rows });
    return rows;
  });
}

/** Formats every browser we support can paint. HEIC is Safari-only, so it's out. */
const PAINTABLE = /^image\/(jpeg|png|webp|gif|avif|svg\+xml)\b/i;

/**
 * Header-only check that a URL exists and is paintable — never downloads the
 * photo. A network error counts as paintable; the slide's <img> error is the backstop.
 */
async function canDisplay(src: string): Promise<boolean> {
  try {
    const res = await fetch(src, { method: "HEAD" });
    return res.ok && PAINTABLE.test(res.headers.get("content-type") ?? "");
  } catch {
    return true;
  }
}

export function useCarouselImages(slug: string): {
  slides: CarouselSlide[];
  loading: boolean;
  prune: (src: string) => void;
} {
  const [state, setState] = useState<SlideState>({
    slug: "",
    slides: EMPTY,
    loading: true,
  });

  const prune = useCallback((src: string) => {
    setState((prev) =>
      prev.slides.some((s) => s.src === src)
        ? { ...prev, slides: prev.slides.filter((s) => s.src !== src) }
        : prev
    );
  }, []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    loadRows(slug)
      .then((rows) => {
        if (cancelled) return;
        const slides = rows.map((row) => ({ src: row.image_url, alt: row.alt_text }));
        // Publish now — don't hold the whole strip hostage to the slowest photo.
        setState({ slug, slides, loading: false });

        // Header checks are tiny, so they run in parallel; a row whose file is
        // missing or unpaintable must never surface as a permanently blank slide.
        slides.forEach((slide) => {
          void canDisplay(slide.src).then((ok) => {
            if (!cancelled && !ok) prune(slide.src);
          });
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load carousel images", err);
        setState({ slug, slides: EMPTY, loading: false });
      });

    // A slug change while a request is in flight discards the late answer.
    return () => {
      cancelled = true;
    };
  }, [slug, prune]);

  // Slides from a previous slug never leak into the current page; a slug
  // whose fetch hasn't landed yet reports as still loading.
  return state.slug === slug
    ? { slides: state.slides, loading: state.loading, prune }
    : { slides: EMPTY, loading: true, prune };
}
