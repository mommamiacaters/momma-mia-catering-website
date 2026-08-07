// services/carouselService.ts
// Service-page carousel photos (public.carousel_images). The storefront reads
// the active rows for one slug; the admin console reads/writes every row.
// Images live in the public `menu-images` bucket under carousel/<slug>/.
import { supabase } from "../lib/supabase";

const BUCKET = "menu-images";
const COLUMNS = "id, service_slug, image_url, storage_path, alt_text, sort_order, is_active";

export interface CarouselImage {
  id: number;
  service_slug: string;
  image_url: string;
  storage_path: string | null;
  alt_text: string | null;
  sort_order: number;
  is_active: boolean;
}

/** Fields the admin supplies when attaching an uploaded image to a service. */
export interface NewCarouselImage {
  service_slug: string;
  image_url: string;
  storage_path?: string | null;
  alt_text?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

/** What the admin may edit on an existing row. */
export type CarouselImagePatch = Partial<
  Pick<CarouselImage, "image_url" | "storage_path" | "alt_text" | "sort_order" | "is_active">
>;

/** Storefront read: the active images for one service page, in display order. */
export async function listCarouselImages(serviceSlug: string): Promise<CarouselImage[]> {
  const { data, error } = await supabase
    .from("carousel_images")
    .select(COLUMNS)
    .eq("service_slug", serviceSlug)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CarouselImage[];
}

/**
 * Admin read: every row (including inactive), grouped by service_slug. One
 * round trip covers all five carousels, so the admin screen loads once.
 */
export async function listAllCarouselImages(): Promise<Record<string, CarouselImage[]>> {
  const { data, error } = await supabase
    .from("carousel_images")
    .select(COLUMNS)
    .order("service_slug", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);

  const grouped: Record<string, CarouselImage[]> = {};
  for (const row of (data ?? []) as CarouselImage[]) {
    (grouped[row.service_slug] ??= []).push(row);
  }
  return grouped;
}

// The object key's extension comes from the MIME type, never from the file name.
// SVG is excluded on purpose: this bucket is public and served inline, so a
// script-bearing SVG would execute on the storage origin.
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Upload a carousel photo to Storage and return its public URL + object key. */
export async function uploadCarouselImage(
  serviceSlug: string,
  file: File,
): Promise<{ image_url: string; storage_path: string }> {
  const ext = EXT_BY_TYPE[file.type.toLowerCase()];
  if (!ext) throw new Error("Use a photo — JPG, PNG, WebP, GIF, AVIF or HEIC.");
  const path = `carousel/${serviceSlug}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { image_url: data.publicUrl, storage_path: path };
}

/** Drop an uploaded file whose row never landed, so it can't linger unreferenced. */
export async function discardCarouselUpload(storagePath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath]);
}

/**
 * Insert a row. Selects the row back so an RLS-denied write surfaces as an
 * error instead of a silent success.
 */
export async function addCarouselImage(input: NewCarouselImage): Promise<CarouselImage> {
  const { data, error } = await supabase
    .from("carousel_images")
    .insert({
      service_slug: input.service_slug,
      image_url: input.image_url,
      storage_path: input.storage_path ?? null,
      alt_text: input.alt_text ?? null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as CarouselImage;
}

export async function updateCarouselImage(
  id: number,
  patch: CarouselImagePatch,
): Promise<CarouselImage> {
  const { data, error } = await supabase
    .from("carousel_images")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as CarouselImage;
}

/**
 * Delete a row, then its stored object. The row goes first and is selected back
 * so an RLS-denied delete surfaces as an error instead of a silent success; the
 * file is then removed best-effort, because an orphaned file beats a live
 * carousel entry pointing at a deleted image.
 */
export async function deleteCarouselImage(
  image: Pick<CarouselImage, "id" | "storage_path">,
): Promise<void> {
  const { data, error } = await supabase
    .from("carousel_images")
    .delete()
    .eq("id", image.id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error(
      "That photo could not be deleted — it may already be gone, or you may need to sign in again.",
    );
  }

  if (image.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([image.storage_path]);
    if (storageError) {
      throw new Error(`Image removed, but its file could not be deleted: ${storageError.message}`);
    }
  }
}

/** Persist a drag-and-drop reorder: sort_order becomes the array index. */
export async function reorderCarouselImages(
  serviceSlug: string,
  orderedIds: number[],
): Promise<void> {
  if (!orderedIds.length) return;
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("carousel_images")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("service_slug", serviceSlug)
        .select("id"),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  // An RLS-filtered update matches zero rows and reports no error, so an
  // unconfirmed row means the new order was never saved.
  if (results.some((r) => !r.data?.length)) {
    throw new Error("The new order could not be saved — reload to see the current order.");
  }
}
