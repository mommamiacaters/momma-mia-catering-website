// Shared upload guard for the public `menu-images` bucket.
//
// The extension always comes from the MIME type, never from the file name.
// SVG is excluded on purpose: the bucket is public and served inline, so a
// script-bearing SVG would execute on the storage origin.
export const MENU_IMAGES_BUCKET = "menu-images";

/**
 * How long a browser may keep an uploaded image, in seconds (one year).
 *
 * Safe because every object key carries a fresh UUID: a given URL's bytes never
 * change, and replacing a photo writes a new key and a new URL. Supabase's
 * default of one hour meant every visit past that hour re-validated each photo
 * over the network before it would paint.
 */
export const UPLOAD_CACHE_CONTROL = "31536000";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/**
 * The file extension to store this image under.
 *
 * Throws with wording the shop owner can act on. HEIC gets its own message
 * because iPhone photos arrive that way constantly and "unsupported file type"
 * doesn't tell anyone what to do about it.
 */
export function uploadExtension(file: File): string {
  const ext = EXT_BY_TYPE[file.type.toLowerCase()];
  if (ext) return ext;
  const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  throw new Error(
    heic
      ? "iPhone HEIC photos can't be shown by most browsers. Export or share it as JPEG first, then upload."
      : "Use a photo — JPG, PNG, WebP, GIF or AVIF.",
  );
}

// ---------------------------------------------------------------- downscaling

/** Formats a browser will happily render, so re-encoding is optional for them. */
const WEB_SAFE = new Set(["image/jpeg", "image/jpg", "image/webp", "image/avif"]);

/** Below this a re-encode isn't worth the quality loss. */
const SKIP_BYTES = 300 * 1024;

/** Longest edge to keep, per surface. Sized for a 2x screen at display size. */
export const MAX_EDGE = {
  /** Homepage panel: a full-height column, so the tall edge does the work. */
  service: 2000,
  /** Service-page carousel: 840x560 CSS at desktop. */
  carousel: 1800,
  /** Menu photos never render large. */
  menuItem: 1200,
} as const;

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Shrink an oversized photo before it goes to Storage.
 *
 * Phone cameras produce 3-5 MB files and the storefront was serving them at
 * full resolution to render a 300px card. This decodes, scales the longest edge
 * down to `maxEdge`, and re-encodes.
 *
 * Deliberately conservative: any failure, any result that isn't actually
 * smaller, and any format it can't re-encode safely returns the ORIGINAL file.
 * A photo that uploads slightly too large beats one that doesn't upload.
 */
export async function prepareImageForUpload(
  file: File,
  maxEdge: number = MAX_EDGE.carousel,
  quality = 0.82,
): Promise<File> {
  if (file.size <= SKIP_BYTES && WEB_SAFE.has(file.type.toLowerCase())) return file;
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    // from-image applies the EXIF rotation, which canvas otherwise drops —
    // without it every portrait phone photo uploads on its side.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    // WebP first: it keeps transparency and is markedly smaller than JPEG.
    let blob = await toBlob(canvas, "image/webp", quality);
    let type = "image/webp";
    if (blob?.type !== "image/webp") {
      // No WebP encoder. JPEG has no alpha channel, so only take that path for
      // a source that had none either — otherwise transparency turns black.
      if (!WEB_SAFE.has(file.type.toLowerCase())) return file;
      blob = await toBlob(canvas, "image/jpeg", quality);
      type = "image/jpeg";
      if (blob?.type !== "image/jpeg") return file;
    }
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.${type === "image/webp" ? "webp" : "jpg"}`, { type });
  } finally {
    bitmap.close();
  }
}
