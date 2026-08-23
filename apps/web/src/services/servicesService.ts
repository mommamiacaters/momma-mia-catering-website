// services/servicesService.ts
// The five service pages (public.services). The storefront reads the active
// rows; the admin console reads and writes every row.
import { supabase } from "../lib/supabase";
import {
  MAX_EDGE,
  MENU_IMAGES_BUCKET,
  UPLOAD_CACHE_CONTROL,
  prepareImageForUpload,
  uploadExtension,
} from "./imageUpload";

const COLUMNS =
  "slug, name, page_title, description, icon_id, image_url, storage_path, kind, is_active, sort_order";

export interface ServiceRecord {
  slug: string;
  name: string;
  page_title: string;
  /** Blank means "use the copy bundled with the site". */
  description: string;
  icon_id: string;
  /** null = the site's bundled photo for this service. */
  image_url: string | null;
  storage_path: string | null;
  kind: "orderable" | "quote";
  is_active: boolean;
  sort_order: number;
}

export type ServicePatch = Partial<
  Pick<
    ServiceRecord,
    | "name"
    | "page_title"
    | "description"
    | "icon_id"
    | "image_url"
    | "storage_path"
    | "is_active"
    | "sort_order"
  >
>;

/** Every service the caller is allowed to see, in display order. */
export async function listServices(): Promise<ServiceRecord[]> {
  const { data, error } = await supabase
    .from("services")
    .select(COLUMNS)
    .order("sort_order", { ascending: true })
    .order("slug", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceRecord[];
}

/**
 * Admin write.
 *
 * Selects the row back: an RLS-denied PATCH returns 204 with no error, so
 * without this the console would report a successful save for a write that
 * never landed.
 */
export async function updateService(
  slug: string,
  patch: ServicePatch,
): Promise<ServiceRecord> {
  const { data, error } = await supabase
    .from("services")
    .update(patch)
    .eq("slug", slug)
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    if (/services_(name|page_title)_not_blank/.test(error.message)) {
      throw new Error("The name and the page heading can't be empty.");
    }
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(
      "Nothing was saved — your account may not have admin access. Sign out and back in, then try again.",
    );
  }
  return data as ServiceRecord;
}

/** Upload a homepage photo and return its public URL + object key. */
export async function uploadServiceImage(
  slug: string,
  file: File,
): Promise<{ image_url: string; storage_path: string }> {
  // Validate the file the admin picked, then store whatever the downscaler
  // hands back — re-encoding can change the type, so the extension follows it.
  uploadExtension(file);
  const upload = await prepareImageForUpload(file, MAX_EDGE.service);
  const path = `services/${slug}/${crypto.randomUUID()}.${uploadExtension(upload)}`;
  const { error } = await supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .upload(path, upload, {
      contentType: upload.type,
      cacheControl: UPLOAD_CACHE_CONTROL,
      upsert: false,
    });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(MENU_IMAGES_BUCKET).getPublicUrl(path);
  return { image_url: data.publicUrl, storage_path: path };
}

/** Best-effort cleanup for a file whose row never landed, or one just replaced. */
export async function removeServiceImage(storagePath: string): Promise<void> {
  await supabase.storage.from(MENU_IMAGES_BUCKET).remove([storagePath]);
}
