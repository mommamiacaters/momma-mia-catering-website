// Storefront read of the admin-managed carousel photos for one service page.
//
// Slides are published the moment the ROWS arrive — the carousel renders
// immediately with per-slide skeletons and each photo pops in as it loads.
// The old behaviour decoded every image up front (23 photos on Catering)
// before showing anything, which read as a blank page for several seconds.
// Broken files are still weeded out, just in the background: each URL is
// decoded off-screen after publish and a failure prunes that one slide.
import { useEffect, useState } from "react";
import { listCarouselImages } from "../services/carouselService";

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

/** Decodes an image off-screen. false = the URL is broken or won't decode. */
async function canDecode(src: string): Promise<boolean> {
  const img = new Image();
  img.src = src;
  return img.decode().then(
    () => true,
    () => false,
  );
}

export function useCarouselImages(slug: string): {
  slides: CarouselSlide[];
  loading: boolean;
} {
  const [state, setState] = useState<SlideState>({
    slug: "",
    slides: EMPTY,
    loading: true,
  });

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    listCarouselImages(slug)
      .then((rows) => {
        if (cancelled) return;
        const slides = rows.map((row) => ({ src: row.image_url, alt: row.alt_text }));
        // Publish now — don't hold the whole strip hostage to the slowest photo.
        setState({ slug, slides, loading: false });

        // Background sweep: decode one URL at a time (so the validation never
        // races the visible slide for bandwidth) and prune what won't paint —
        // a row whose stored file is missing or corrupt must never surface as
        // a permanently blank slide. Delayed so the first photo wins the wire.
        const validate = async () => {
          await new Promise((r) => setTimeout(r, 800));
          for (const slide of slides) {
            if (cancelled) return;
            const ok = await canDecode(slide.src);
            if (cancelled) return;
            if (!ok) {
              setState((prev) =>
                prev.slug === slug
                  ? { ...prev, slides: prev.slides.filter((s) => s.src !== slide.src) }
                  : prev
              );
            }
          }
        };
        void validate();
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
  }, [slug]);

  // Slides from a previous slug never leak into the current page; a slug
  // whose fetch hasn't landed yet reports as still loading.
  return state.slug === slug
    ? { slides: state.slides, loading: state.loading }
    : { slides: EMPTY, loading: true };
}
