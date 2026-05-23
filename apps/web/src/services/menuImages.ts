import { supabase } from "../lib/supabase";

const BUCKET = "menu-images";

/**
 * Upload a menu photo to Supabase Storage and return its public URL.
 * The admin just picks a file; the storage path + public URL are handled here.
 */
export async function uploadMenuImage(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `items/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
