import React from "react";

type ImageProps = {
  src: string;
  alt: string;
  className?: string;
  visible?: boolean; // kept for backward compatibility with prior usage
};

/**
 * Reusable Image component.
 * - Mirrors MealCard hover behavior by default (hover scale & transform transition).
 * - Optionally enables a fade-in animation on image load (image-only, text unaffected).
 */
const Image: React.FC<ImageProps> = ({ src, alt, className }) => {
  const base = "w-full h-full group-hover:scale-105 transition-transform duration-300";
  // default to cover unless overridden by className
  const fit = "object-cover";
  return <img src={src} alt={alt} className={`${base} ${fit} ${className ?? ""}`.trim()} />;
};

export default Image;
// add reusable image here,
