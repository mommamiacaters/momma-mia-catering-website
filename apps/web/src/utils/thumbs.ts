// Dish photos carry a small WebP beside the original, found by name:
//   menu-images/items/<uuid>.png  ->  menu-images/items/<uuid>_thumb.webp
// Cards and cart rows show the thumb; the lightbox keeps the original. Any URL
// outside items/ (external links, carousel) has no thumb and passes through.
// A thumb that doesn't exist yet falls back to the original via onError.

const ITEMS_PATH = "/storage/v1/object/public/menu-images/items/";
const THUMB_SUFFIX = "_thumb.webp";

/** Longest edge of a thumb: a ~320px card at 2x. */
export const THUMB_EDGE = 640;

/** Storage key of an object's thumb: items/abc.png -> items/abc_thumb.webp. */
export function thumbPathFor(objectPath: string): string {
  return objectPath.replace(/\.[^./]+$/, "") + THUMB_SUFFIX;
}

/** The thumb URL for a dish photo, or the URL unchanged when it has none. */
export function thumbUrl(src: string | null | undefined): string {
  if (!src) return "";
  const path = src.split("?")[0];
  if (!path.includes(ITEMS_PATH) || path.endsWith(THUMB_SUFFIX)) return src;
  return thumbPathFor(path);
}
