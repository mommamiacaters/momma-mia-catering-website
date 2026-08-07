import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SafeImage from "../../components/ui/SafeImage";
import { CAROUSEL_SERVICES, getServiceFallbackImages } from "../../constants/serviceContent";
import {
  addCarouselImage,
  deleteCarouselImage,
  discardCarouselUpload,
  listAllCarouselImages,
  reorderCarouselImages,
  updateCarouselImage,
  uploadCarouselImage,
} from "../../services/carouselService";
import type { CarouselImage } from "../../services/carouselService";

const readMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

const titleFor = (slug: string) =>
  CAROUSEL_SERVICES.find((s) => s.slug === slug)?.title ?? slug;

const iconButton =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer " +
  "focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-30 " +
  "disabled:cursor-not-allowed disabled:hover:bg-transparent";

// ------------------------------------------------------------------ one photo

interface ImageTileProps {
  image: CarouselImage;
  /** 1-based position shown to the admin and used in the button labels. */
  position: number;
  isFirst: boolean;
  isLast: boolean;
  serviceTitle: string;
  onMove: (delta: number) => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onSaveAlt: (value: string | null) => void;
}

/** A single carousel photo with its order, visibility, alt text and delete controls. */
const ImageTile: React.FC<ImageTileProps> = ({
  image,
  position,
  isFirst,
  isLast,
  serviceTitle,
  onMove,
  onToggleActive,
  onDelete,
  onSaveAlt,
}) => {
  const [draft, setDraft] = useState(image.alt_text ?? "");

  // Follow the saved value when it changes underneath (a reload after an error).
  useEffect(() => setDraft(image.alt_text ?? ""), [image.alt_text]);

  const label = `photo ${position} of ${serviceTitle}`;

  const commitAlt = () => {
    const next = draft.trim();
    if (next === (image.alt_text ?? "")) return;
    onSaveAlt(next === "" ? null : next);
  };

  return (
    <li className="relative rounded-lg border border-brand-divider bg-white overflow-hidden">
      <div
        className={`relative aspect-[4/3] bg-brand-secondary ${image.is_active ? "" : "opacity-40"}`}
      >
        <SafeImage
          src={image.image_url}
          alt={image.alt_text ?? ""}
          className="h-full w-full object-cover"
        />
        <span className="absolute left-2 top-2 rounded-full bg-brand-text/70 px-2 py-0.5 font-poppins text-[10px] text-white">
          {position}
        </span>
      </div>

      {!image.is_active && (
        <span className="absolute right-2 top-2 rounded-full bg-gray-700/90 px-2 py-0.5 font-poppins text-[10px] font-medium text-white">
          Hidden
        </span>
      )}

      <div className="px-2 pt-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitAlt}
          placeholder="Describe this photo"
          aria-label={`Description for ${label}`}
          className="w-full rounded-md border border-brand-divider px-2 py-1.5 font-poppins text-xs text-brand-text placeholder:text-brand-text/40 focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
      </div>

      <div className="flex items-center justify-between gap-1 px-2 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label={`Move ${label} earlier`}
            className={`${iconButton} text-brand-text/60 hover:bg-brand-secondary`}
          >
            <i className="pi pi-chevron-left text-xs" aria-hidden="true" />
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label={`Move ${label} later`}
            className={`${iconButton} text-brand-text/60 hover:bg-brand-secondary`}
          >
            <i className="pi pi-chevron-right text-xs" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleActive}
            aria-label={
              image.is_active ? `Hide ${label} from the website` : `Show ${label} on the website`
            }
            title={image.is_active ? "Showing on website — click to hide" : "Hidden — click to show"}
            className={`${iconButton} ${
              image.is_active
                ? "text-green-700 hover:bg-green-50"
                : "text-brand-text/40 hover:bg-brand-secondary"
            }`}
          >
            <i
              className={`pi ${image.is_active ? "pi-eye" : "pi-eye-slash"} text-xs`}
              aria-hidden="true"
            />
          </button>
          <button
            onClick={onDelete}
            aria-label={`Delete ${label}`}
            className={`${iconButton} text-red-500 hover:bg-red-50`}
          >
            <i className="pi pi-trash text-xs" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
};

// --------------------------------------------------------------- one service

interface ServiceSectionProps {
  slug: string;
  title: string;
  images: CarouselImage[];
  isOpen: boolean;
  /** Deep-linked from the Menu Manager — ring it so the admin lands on it. */
  highlighted: boolean;
  uploadingCount: number;
  onToggle: () => void;
  onUpload: (files: FileList | null) => void;
  onMove: (index: number, delta: number) => void;
  onToggleActive: (image: CarouselImage) => void;
  onDelete: (image: CarouselImage, position: number) => void;
  onSaveAlt: (image: CarouselImage, value: string | null) => void;
  sectionRef: (el: HTMLElement | null) => void;
}

/** Collapsible card for one service page's carousel. */
const ServiceSection: React.FC<ServiceSectionProps> = ({
  slug,
  title,
  images,
  isOpen,
  highlighted,
  uploadingCount,
  onToggle,
  onUpload,
  onMove,
  onToggleActive,
  onDelete,
  onSaveAlt,
  sectionRef,
}) => {
  const uploading = uploadingCount > 0;
  const fallbacks = getServiceFallbackImages(slug);
  // The live page only sees active rows, so zero active means it falls back.
  const activeCount = images.filter((row) => row.is_active).length;

  return (
    <section
      ref={sectionRef}
      // Focus target after a delete removes the tile that held focus.
      tabIndex={-1}
      aria-label={`${title} carousel`}
      className={`scroll-mt-24 bg-white rounded-xl shadow-sm border overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
        highlighted ? "border-brand-primary ring-2 ring-brand-primary/25" : "border-brand-divider"
      }`}
    >
      <div className="flex items-center">
        <button
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex flex-1 items-center gap-3 px-4 py-3.5 text-left cursor-pointer hover:bg-brand-secondary/40 transition-colors"
        >
          <i
            className={`pi pi-chevron-right text-brand-text/40 text-sm transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
          <span className="font-arvo-bold text-lg text-brand-text">{title}</span>
          <span className="rounded-full bg-brand-accent/20 px-2 py-0.5 text-xs font-poppins text-brand-text/70">
            {images.length} {images.length === 1 ? "image" : "images"}
          </span>
          {activeCount === 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-poppins text-amber-700">
              Built-in photos
            </span>
          )}
        </button>

        <label
          className={`mr-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-arvo-bold text-brand-primary transition-colors focus-within:ring-2 focus-within:ring-brand-primary ${
            uploading ? "opacity-60 cursor-wait" : "hover:bg-brand-primary/10 cursor-pointer"
          }`}
        >
          <i
            className={`pi ${uploading ? "pi-spinner pi-spin" : "pi-upload"} text-xs`}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">
            {uploading ? `Uploading ${uploadingCount}…` : "Upload images"}
          </span>
          <span className="sm:hidden">{uploading ? `${uploadingCount}…` : "Upload"}</span>
          <input
            type="file"
            multiple
            accept="image/*"
            disabled={uploading}
            className="sr-only"
            onChange={(e) => {
              onUpload(e.target.files);
              // Reset so picking the SAME files again still fires a change event.
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div
        className={`grid transition-all duration-200 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-brand-divider p-4">
            {images.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-brand-divider px-4 py-8 text-center">
                <i className="pi pi-images text-2xl text-brand-text/30" aria-hidden="true" />
                <p className="mt-2 font-arvo-bold text-sm text-brand-text">
                  No custom photos yet — this page is showing the built-in ones.
                </p>
                <p className="mt-1 font-poppins text-xs text-brand-text/60">
                  Upload to replace them. Delete every photo here and the built-in ones come back.
                </p>
                {fallbacks.length > 0 && (
                  <ul className="mt-4 flex flex-wrap justify-center gap-2">
                    {fallbacks.slice(0, 6).map((src) => (
                      <li
                        key={src}
                        className="h-14 w-20 overflow-hidden rounded-md border border-brand-divider"
                      >
                        <img
                          src={src}
                          alt=""
                          className="h-full w-full object-cover opacity-70"
                          loading="lazy"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <>
                <p
                  className={`mb-3 font-poppins text-xs ${
                    activeCount === 0 ? "text-amber-700" : "text-brand-text/60"
                  }`}
                >
                  {activeCount === 0
                    ? "Every photo here is hidden, so the live page is showing the built-in ones. Unhide at least one to use these."
                    : "These replace the built-in photos on the live page. They show in this order."}
                </p>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {images.map((image, index) => (
                    <ImageTile
                      key={image.id}
                      image={image}
                      position={index + 1}
                      isFirst={index === 0}
                      isLast={index === images.length - 1}
                      serviceTitle={title}
                      onMove={(delta) => onMove(index, delta)}
                      onToggleActive={() => onToggleActive(image)}
                      onDelete={() => onDelete(image, index + 1)}
                      onSaveAlt={(value) => onSaveAlt(image, value)}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------- the screen

const AdminCarousels: React.FC = () => {
  const [groups, setGroups] = useState<Record<string, CarouselImage[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Announced to screen readers — the grid actions have no other confirmation.
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(
    () => new Set(CAROUSEL_SERVICES.map((s) => s.slug)),
  );

  const [searchParams] = useSearchParams();
  const requested = searchParams.get("service");
  const focusSlug = CAROUSEL_SERVICES.some((s) => s.slug === requested) ? requested : null;
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrolled = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await listAllCarouselImages());
    } catch (err) {
      setError(readMessage(err, "Could not load the carousel photos."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Deep link from the Menu Manager: open that service and bring it into view.
  useEffect(() => {
    if (loading || !focusSlug || scrolled.current) return;
    scrolled.current = true;
    setOpenSlugs((prev) => new Set(prev).add(focusSlug));
    requestAnimationFrame(() =>
      sectionRefs.current[focusSlug]?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, [loading, focusSlug]);

  const toggleSection = (slug: string) =>
    setOpenSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  // One file at a time so a single bad photo can't take the whole batch with it;
  // each success lands in the grid immediately.
  const handleUpload = async (slug: string, files: FileList | null) => {
    const picked = Array.from(files ?? []);
    const photos = picked.filter((f) => f.type.startsWith("image/"));
    if (photos.length === 0) {
      if (picked.length > 0) setError("Those files aren't images — choose JPG or PNG photos.");
      return;
    }

    const startOrder =
      (groups[slug] ?? []).reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
    setUploading((prev) => ({ ...prev, [slug]: photos.length }));
    const failures: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      let uploadedPath: string | null = null;
      try {
        const { image_url, storage_path } = await uploadCarouselImage(slug, file);
        uploadedPath = storage_path;
        const row = await addCarouselImage({
          service_slug: slug,
          image_url,
          storage_path,
          sort_order: startOrder + i,
        });
        uploadedPath = null;
        setGroups((prev) => ({ ...prev, [slug]: [...(prev[slug] ?? []), row] }));
      } catch (err) {
        // The file landed but its row didn't; drop it so the bucket keeps no
        // object the admin can't see or delete.
        if (uploadedPath) await discardCarouselUpload(uploadedPath).catch(() => undefined);
        failures.push(`${file.name} (${readMessage(err, "upload failed")})`);
      } finally {
        setUploading((prev) => ({ ...prev, [slug]: Math.max(0, (prev[slug] ?? 1) - 1) }));
      }
    }

    const added = photos.length - failures.length;
    if (added > 0)
      setStatus(`${added} ${added === 1 ? "photo" : "photos"} added to ${titleFor(slug)}.`);
    if (failures.length > 0) setError(`Some photos didn't upload: ${failures.join(", ")}`);
  };

  const handleMove = async (slug: string, index: number, delta: number) => {
    const list = groups[slug] ?? [];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;

    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    const ordered = next.map((row, i) => ({ ...row, sort_order: i }));
    setGroups((prev) => ({ ...prev, [slug]: ordered }));

    try {
      await reorderCarouselImages(slug, ordered.map((row) => row.id));
    } catch (err) {
      setError(readMessage(err, "Could not save the new order."));
      await load();
    }
  };

  const handleToggleActive = async (slug: string, image: CarouselImage) => {
    setGroups((prev) => ({
      ...prev,
      [slug]: (prev[slug] ?? []).map((row) =>
        row.id === image.id ? { ...row, is_active: !row.is_active } : row,
      ),
    }));
    try {
      await updateCarouselImage(image.id, { is_active: !image.is_active });
    } catch (err) {
      setError(readMessage(err, "Could not change the photo's visibility."));
      await load();
    }
  };

  const handleDelete = async (slug: string, image: CarouselImage, position: number) => {
    if (!window.confirm(`Delete photo ${position}? This can't be undone.`)) return;
    const remaining = (groups[slug] ?? []).length - 1;
    setGroups((prev) => ({
      ...prev,
      [slug]: (prev[slug] ?? []).filter((row) => row.id !== image.id),
    }));
    try {
      await deleteCarouselImage(image);
      setStatus(
        `Photo ${position} deleted. ${remaining} ${remaining === 1 ? "photo" : "photos"} left in ${titleFor(slug)}.`,
      );
      // The delete button just unmounted with its tile, so focus would fall to
      // <body>. Put it back on the section the admin was working in.
      sectionRefs.current[slug]?.focus();
    } catch (err) {
      // Either the row survived or only its file failed to go; reload for the truth.
      setError(readMessage(err, "Could not delete the photo."));
      await load();
    }
  };

  const handleSaveAlt = async (slug: string, image: CarouselImage, value: string | null) => {
    setGroups((prev) => ({
      ...prev,
      [slug]: (prev[slug] ?? []).map((row) =>
        row.id === image.id ? { ...row, alt_text: value } : row,
      ),
    }));
    try {
      await updateCarouselImage(image.id, { alt_text: value });
    } catch (err) {
      setError(readMessage(err, "Could not save the description."));
      await load();
    }
  };

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-arvo-bold text-2xl text-brand-text">Page Carousels</h1>
          <p className="font-poppins text-sm text-brand-text/60 mt-0.5">
            The photos that slide across the top of each service page. Upload your own to replace
            the built-in ones.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer" aria-label="Dismiss">
            <i className="pi pi-times" aria-hidden="true" />
          </button>
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {CAROUSEL_SERVICES.map(({ slug, title }) => (
            <ServiceSection
              key={slug}
              slug={slug}
              title={title}
              images={groups[slug] ?? []}
              isOpen={openSlugs.has(slug)}
              highlighted={focusSlug === slug}
              uploadingCount={uploading[slug] ?? 0}
              onToggle={() => toggleSection(slug)}
              onUpload={(files) => void handleUpload(slug, files)}
              onMove={(index, delta) => void handleMove(slug, index, delta)}
              onToggleActive={(image) => void handleToggleActive(slug, image)}
              onDelete={(image, position) => void handleDelete(slug, image, position)}
              onSaveAlt={(image, value) => void handleSaveAlt(slug, image, value)}
              sectionRef={(el) => {
                sectionRefs.current[slug] = el;
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCarousels;
