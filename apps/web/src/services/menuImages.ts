import { supabase } from "../lib/supabase";
import { MAX_EDGE, UPLOAD_CACHE_CONTROL, prepareImageForUpload, uploadExtension } from "./imageUpload";

const BUCKET = "menu-images";

/**
 * Upload a menu photo to Supabase Storage and return its public URL.
 * The admin just picks a file; the storage path + public URL are handled here.
 */
export async function uploadMenuImage(file: File): Promise<string> {
  // The extension comes from the MIME type, never the file name: a ".jpg"
  // that is really a HEIC would upload and then fail to render.
  uploadExtension(file);
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
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
