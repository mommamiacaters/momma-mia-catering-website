import React, { useState, useRef, useEffect, memo } from "react";

export const FALLBACK_IMAGE =
  "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop";

// Global set tracking which URLs have already been loaded in this session
const loadedImages = new Set<string>();

interface CachedImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallback?: string;
}

const CachedImage: React.FC<CachedImageProps> = memo(({
  src,
  alt,
  className = "",
  containerClassName = "",
  fallback = FALLBACK_IMAGE,
}) => {
  const imgSrc = src || fallback;
  const alreadyCached = loadedImages.has(imgSrc);
  const [loaded, setLoaded] = useState(alreadyCached);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle images that load from cache before onLoad fires
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      loadedImages.add(imgSrc);
      setLoaded(true);
    }
  }, [imgSrc]);

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

      <img
        ref={imgRef}
        src={displaySrc}
        alt={alt}
        className={`transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        } ${className}`}
        onLoad={handleLoad}
        onError={handleError}
        loading="eager"
        decoding="async"
      />
    </div>
  );
});

CachedImage.displayName = "CachedImage";

export default CachedImage;

/**
 * Preload a list of image URLs into the browser cache.
 * Call this once when menuData arrives to warm the cache
 * for all categories before the user switches tabs.
 */
export function preloadImages(urls: string[]): void {
  for (const url of urls) {
    if (!url || loadedImages.has(url)) continue;
    const img = new window.Image();
    img.src = url;
    img.onload = () => loadedImages.add(url);
  }
}
