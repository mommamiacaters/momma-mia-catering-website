import React from "react";

type ImageProps = {
  src: string;
  alt: string;
  className?: string;
};

/**
 * Reusable Image component.
 * - Mirrors MealCard hover behavior by default (hover scale & transform transition).
 * - Optionally enables a fade-in animation on image load (image-only, text unaffected).
 */
const Image: React.FC<ImageProps> = ({ src, alt }) => {
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
    />
  );
};

export default Image;
// add reusable image here,
