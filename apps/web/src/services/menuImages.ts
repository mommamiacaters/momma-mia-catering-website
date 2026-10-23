import { supabase } from "../lib/supabase";
import {
  MAX_EDGE,
  UPLOAD_CACHE_CONTROL,
  makeThumbnail,
  prepareImageForUpload,
  uploadExtension,
} from "./imageUpload";
import { THUMB_EDGE, thumbPathFor } from "../utils/thumbs";

const BUCKET = "menu-images";

/**
 * Upload a menu photo to Supabase Storage and return its public URL.
 * The admin just picks a file; the storage path + public URL are handled here.
 * A thumb is written beside it for cards and cart rows (see utils/thumbs).
 */
export async function uploadMenuImage(file: File): Promise<string> {
  // The extension comes from the MIME type, never the file name: a ".jpg"
  // that is really a HEIC would upload and then fail to render.
  const upload = await prepareImageForUpload(file, MAX_EDGE.menuItem);
  const path = `items/${crypto.randomUUID()}.${uploadExtension(upload)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, upload, {
      contentType: upload.type,
      cacheControl: UPLOAD_CACHE_CONTROL,
      upsert: false,
    });
  if (error) throw new Error(error.message);

  // Best effort: without a thumb the storefront shows the original instead.
  const thumb = await makeThumbnail(upload, THUMB_EDGE);
  if (thumb) {
    const { error: thumbError } = await supabase.storage
      .from(BUCKET)
      .upload(thumbPathFor(path), thumb, {
        contentType: thumb.type,
        cacheControl: UPLOAD_CACHE_CONTROL,
        upsert: false,
      });
    if (thumbError) console.warn("Dish thumbnail upload failed:", thumbError.message);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
