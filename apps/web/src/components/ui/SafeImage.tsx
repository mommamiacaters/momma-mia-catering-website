import React, { useEffect, useState } from "react";

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  /** Applied to the <img>; the fallback fills the same box. */
  className?: string;
  /** PrimeIcons class for the placeholder, e.g. "pi-image". */
  icon?: string;
  iconClass?: string;
}

/**
 * An <img> that degrades to a branded placeholder instead of a broken-image glyph.
 *
 * Menu photos are arbitrary URLs typed or seeded into menu_items.image_url, so a
 * dead host (several rows still point at loremflickr, which now 500s) would
 * otherwise render as a torn-page icon with alt text — which reads as "the app is
 * broken" rather than "this dish has no photo".
 */
const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = "",
  icon = "pi-image",
  iconClass = "text-brand-text/30 text-lg",
}) => {
  const [failed, setFailed] = useState(false);

  // A new src deserves a fresh attempt — otherwise swapping in a good photo after
  // a bad one would stay stuck on the placeholder.
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <span
        className={`flex h-full w-full items-center justify-center bg-brand-secondary ${className}`}
        role="img"
        aria-label={alt || "No photo"}
      >
        <i className={`pi ${icon} ${iconClass}`} aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

export default SafeImage;
