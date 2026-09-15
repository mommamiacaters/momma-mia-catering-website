import React, { useState, useRef, useEffect, memo } from "react";

export const FALLBACK_IMAGE =
  "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop";

// Swap a dead URL for the fallback. For raw <img> sites that can't take the
// whole component — `src={x || FALLBACK}` only guards empty URLs, not 404s.
export const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src !== FALLBACK_IMAGE) img.src = FALLBACK_IMAGE;
};

// Global set tracking which URLs have already been loaded in this session
const loadedImages = new Set<string>();

interface CachedImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallback?: string;
  /** Fetch immediately instead of on approach. Above-the-fold art only. */
  eager?: boolean;
  /**
   * Show the skeleton and don't request the image at all yet. For content that
   * is mounted but not visible — a hidden tab's grid sits in layout at opacity
   * 0, so native lazy-loading still sees it "in the viewport" and fetches it.
   */
  defer?: boolean;
}

const CachedImage: React.FC<CachedImageProps> = memo(({
  src,
  alt,
  className = "",
  containerClassName = "",
  fallback = FALLBACK_IMAGE,
  eager = false,
  defer = false,
}) => {
  const imgSrc = src || fallback;
  // Lazy by default. A 115-dish grid renders ~9 cards on screen, and eager
  // fetched every one of them at full size the moment the page mounted --
  // hundreds of megabytes of egress for images nobody scrolled to. Above-the-
  // fold art (a hero, a carousel slide) opts back in with eager.
  const loadingAttr = eager ? "eager" : "lazy";
  const alreadyCached = loadedImages.has(imgSrc);
  const [loaded, setLoaded] = useState(alreadyCached);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle images that load from cache before onLoad fires. Re-check when a
  // deferred image finally mounts, since imgSrc itself won't have changed.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      loadedImages.add(imgSrc);
      setLoaded(true);
    }
  }, [imgSrc, defer]);

  const handleLoad = () => {
    loadedImages.add(imgSrc);
    setLoaded(true);
  };

  const handleError = () => {
    setErrored(true);
    setLoaded(true);
  };

  const displaySrc = errored ? fallback : imgSrc;

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* Skeleton shimmer */}
      {!loaded && (
        <div className="absolute inset-0 bg-brand-secondary/50 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>
      )}

      {/* No <img> while deferred: an element with a src is a request, whatever
          its loading attribute says about timing. */}
      {!defer && (
        <img
          ref={imgRef}
          src={displaySrc}
          alt={alt}
          className={`transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          } ${className}`}
          onLoad={handleLoad}
          onError={handleError}
          loading={loadingAttr}
          decoding="async"
        />
      )}
    </div>
  );
});

CachedImage.displayName = "CachedImage";

export default CachedImage;

/**
 * Preload a handful of image URLs into the browser cache.
 *
 * For a few known-critical images only — a hero, the next slide. Do NOT hand it
 * a catalogue: calling this with every dish once pulled ~133MB per page visit
 * and blew the Supabase egress quota. Everything else should lazy-load, which
 * is what CachedImage does by default.
 */
export function preloadImages(urls: string[]): void {
  for (const url of urls) {
    if (!url || loadedImages.has(url)) continue;
    const img = new window.Image();
    img.src = url;
    img.onload = () => loadedImages.add(url);
  }
}
