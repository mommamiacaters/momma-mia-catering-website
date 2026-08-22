import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SafeImage from "../../components/ui/SafeImage";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PaginationBar from "../../components/ui/PaginationBar";
import { CAROUSEL_SERVICES } from "../../constants/serviceContent";
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

/** Photos per page inside a section — two rows of the lg grid. */
const PAGE_SIZE = 8;

type Groups = Record<string, CarouselImage[]>;

const cloneGroups = (g: Groups): Groups =>
  Object.fromEntries(Object.entries(g).map(([k, rows]) => [k, rows.map((r) => ({ ...r }))]));

/** What Save would need to write for one service. */
const diffFor = (saved: CarouselImage[] = [], draft: CarouselImage[] = []) => {
  const savedById = new Map(saved.map((r) => [r.id, r]));
  const rowEdits = draft.filter((d) => {
    const s = savedById.get(d.id);
    return (
      !!s && ((s.alt_text ?? null) !== (d.alt_text ?? null) || s.is_active !== d.is_active)
    );
  });
  const orderChanged =
    saved.length === draft.length && draft.some((d, i) => saved[i]?.id !== d.id);
  return { rowEdits, orderChanged };
};

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
  const [imgFailed, setImgFailed] = useState(false);

  // Follow the saved value when it changes underneath (a reload, or Discard).
  useEffect(() => setDraft(image.alt_text ?? ""), [image.alt_text]);

  // The live page decode-filters its slides, so a record whose file is missing
  // or corrupt is ALREADY hidden out there — this tile's job is to say so.
  const broken = !image.image_url || imgFailed;
  const label = `photo ${position} of ${serviceTitle}`;

  const commitAlt = () => {
    const next = draft.trim();
    if (next === (image.alt_text ?? "")) return;
    onSaveAlt(next === "" ? null : next);
  };

  return (
    <li
      className={`relative rounded-lg border bg-white overflow-hidden ${
        broken ? "border-amber-400 ring-2 ring-amber-300/60" : "border-brand-divider"
      }`}
    >
      <div
        className={`relative aspect-[4/3] bg-brand-secondary ${image.is_active ? "" : "opacity-40"}`}
      >
        <SafeImage
          src={image.image_url}
          alt={image.alt_text ?? ""}
          className="h-full w-full object-cover"
          onStatusChange={setImgFailed}
        />
        <span className="absolute left-2 top-2 rounded-full bg-brand-text/70 px-2 py-0.5 font-poppins text-[10px] text-white">
          {position}
        </span>
      </div>

      <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
        {broken && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 font-poppins text-[10px] font-medium text-white shadow">
            <i className="pi pi-exclamation-triangle mr-1 text-[9px]" aria-hidden="true" />
            Image broken — not shown on site
          </span>
        )}
        {!image.is_active && (
          <span className="rounded-full bg-gray-700/90 px-2 py-0.5 font-poppins text-[10px] font-medium text-white">
            Hidden
          </span>
        )}
      </div>

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
  title: string;
  images: CarouselImage[];
  isOpen: boolean;
  /** Deep-linked from the Menu Manager — ring it so the admin lands on it. */
  highlighted: boolean;
  uploadingCount: number;
  onToggle: () => void;
  onUpload: (files: FileList | null) => void;
  /** index is ABSOLUTE within the service's full list, not the visible page. */
  onMove: (index: number, delta: number) => void;
  onToggleActive: (image: CarouselImage) => void;
  onDelete: (image: CarouselImage, position: number) => void;
  onSaveAlt: (image: CarouselImage, value: string | null) => void;
  sectionRef: (el: HTMLElement | null) => void;
}

/** Collapsible card for one service page's carousel. */
const ServiceSection: React.FC<ServiceSectionProps> = ({
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
  // The live page only sees active rows, so zero active means no carousel.
  const activeCount = images.filter((row) => row.is_active).length;

  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(images.length / PAGE_SIZE));
  // A delete on the last page must not leave the pager pointing past the end.
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);

  const start = (page - 1) * PAGE_SIZE;
  const visible = images.slice(start, start + PAGE_SIZE);

  /** Reorder, then follow the photo onto its new page so it never vanishes. */
  const moveAndFollow = (absIndex: number, delta: number) => {
    const target = absIndex + delta;
    if (target < 0 || target >= images.length) return;
    onMove(absIndex, delta);
    setPage(Math.floor(target / PAGE_SIZE) + 1);
  };

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
          {/* Mounted only while open — a closed section loads zero images. */}
          {isOpen && (
          <div className="border-t border-brand-divider p-4">
            {images.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-brand-divider px-4 py-8 text-center">
                <i className="pi pi-images text-2xl text-brand-text/30" aria-hidden="true" />
                <p className="mt-2 font-arvo-bold text-sm text-brand-text">
                  No photos yet — this page shows no carousel.
                </p>
                <p className="mt-1 font-poppins text-xs text-brand-text/60">
                  Upload photos to give it one. Delete them all and the carousel
                  disappears again.
                </p>
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
                  {visible.map((image, i) => {
                    const absIndex = start + i;
                    return (
                      <ImageTile
                        key={image.id}
                        image={image}
                        position={absIndex + 1}
                        isFirst={absIndex === 0}
                        isLast={absIndex === images.length - 1}
                        serviceTitle={title}
                        onMove={(delta) => moveAndFollow(absIndex, delta)}
                        onToggleActive={() => onToggleActive(image)}
                        onDelete={() => onDelete(image, absIndex + 1)}
                        onSaveAlt={(value) => onSaveAlt(image, value)}
                      />
                    );
                  })}
                </ul>
                {images.length > PAGE_SIZE && (
                  <div className="mt-4 -mx-4 -mb-4">
                    <PaginationBar
                      page={page}
                      pageCount={pageCount}
                      onPageChange={setPage}
                      rangeStart={start + 1}
                      rangeEnd={Math.min(start + PAGE_SIZE, images.length)}
                      total={images.length}
                      noun="photos"
                      label={`${title} photo pages`}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          )}
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------- the screen

const AdminCarousels: React.FC = () => {
  // `groups` is the DRAFT the admin edits; `savedGroups` mirrors the database.
  // Order, visibility and description changes stay in the draft until Save.
  // Uploads and deletes move files in Storage, so they commit immediately and
  // land in both.
  const [groups, setGroups] = useState<Groups>({});
  const [savedGroups, setSavedGroups] = useState<Groups>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Announced to screen readers — the grid actions have no other confirmation.
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState<Record<string, number>>({});
  // Only the first section starts open: closed sections don't mount their
  // <img>s at all (see ServiceSection), so first paint fetches one page of one
  // service instead of every photo of every service. Transform-based
  // thumbnails aren't available on this plan — not mounting IS the optimisation.
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(
    () => new Set(CAROUSEL_SERVICES.slice(0, 1).map((s) => s.slug)),
  );
  const [pendingDelete, setPendingDelete] = useState<{
    slug: string;
    image: CarouselImage;
    position: number;
  } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const [searchParams] = useSearchParams();
  const requested = searchParams.get("service");
  const focusSlug = CAROUSEL_SERVICES.some((s) => s.slug === requested) ? requested : null;
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrolled = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await listAllCarouselImages();
      setSavedGroups(fresh);
      setGroups(cloneGroups(fresh));
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

  // ---- draft edits (local until Save) ---------------------------------------

  const handleMove = (slug: string, index: number, delta: number) => {
    setGroups((prev) => {
      const list = prev[slug] ?? [];
      const target = index + delta;
      if (target < 0 || target >= list.length) return prev;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, [slug]: next.map((row, i) => ({ ...row, sort_order: i })) };
    });
  };

  const handleToggleActive = (slug: string, image: CarouselImage) =>
    setGroups((prev) => ({
      ...prev,
      [slug]: (prev[slug] ?? []).map((row) =>
        row.id === image.id ? { ...row, is_active: !row.is_active } : row,
      ),
    }));

  const handleSaveAlt = (slug: string, image: CarouselImage, value: string | null) =>
    setGroups((prev) => ({
      ...prev,
      [slug]: (prev[slug] ?? []).map((row) =>
        row.id === image.id ? { ...row, alt_text: value } : row,
      ),
    }));

  const dirty = CAROUSEL_SERVICES.map(({ slug }) => ({
    slug,
    ...diffFor(savedGroups[slug], groups[slug]),
  }));
  const dirtyCount = dirty.reduce(
    (n, d) => n + d.rowEdits.length + (d.orderChanged ? 1 : 0),
    0,
  );

  const saveAll = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      for (const { slug, rowEdits, orderChanged } of dirty) {
        for (const row of rowEdits) {
          await updateCarouselImage(row.id, {
            alt_text: row.alt_text,
            is_active: row.is_active,
          });
        }
        if (orderChanged) {
          await reorderCarouselImages(slug, (groups[slug] ?? []).map((r) => r.id));
        }
      }
      setSavedGroups(cloneGroups(groups));
      setStatus("All changes saved to the live site.");
    } catch (err) {
      setError(
        `${readMessage(err, "Could not save your changes.")} Your edits are still here — try Save again.`,
      );
      // Some writes may have landed. Refresh the baseline so a retry only
      // re-sends what is still pending, without touching the draft.
      try {
        setSavedGroups(await listAllCarouselImages());
      } catch {
        /* keep the old baseline; the next Save recomputes against it */
      }
    } finally {
      setSaving(false);
    }
  };

  const discardAll = () => {
    setGroups(cloneGroups(savedGroups));
    setConfirmDiscard(false);
    setStatus("Changes discarded.");
  };

  // ---- immediate actions (they move files in Storage) -----------------------

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
        // New rows join both snapshots: they are already saved, and drafted
        // reorders/edits elsewhere must survive the append.
        setGroups((prev) => ({ ...prev, [slug]: [...(prev[slug] ?? []), { ...row }] }));
        setSavedGroups((prev) => ({ ...prev, [slug]: [...(prev[slug] ?? []), { ...row }] }));
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

  const performDelete = async () => {
    if (!pendingDelete) return;
    const { slug, image, position } = pendingDelete;
    setPendingDelete(null);
    const without = (g: Groups) => ({
      ...g,
      [slug]: (g[slug] ?? []).filter((row) => row.id !== image.id),
    });
    const remaining = (groups[slug] ?? []).length - 1;
    setGroups(without);
    setSavedGroups(without);
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

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-arvo-bold text-2xl text-brand-text">Page Carousels</h1>
          <p className="font-poppins text-sm text-brand-text/60 mt-0.5">
            The photos that slide across the top of each service page. Upload your own to replace
            the built-in ones. Order, visibility and description changes go live when you save.
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
              title={title}
              images={groups[slug] ?? []}
              isOpen={openSlugs.has(slug)}
              highlighted={focusSlug === slug}
              uploadingCount={uploading[slug] ?? 0}
              onToggle={() => toggleSection(slug)}
              onUpload={(files) => void handleUpload(slug, files)}
              onMove={(index, delta) => handleMove(slug, index, delta)}
              onToggleActive={(image) => handleToggleActive(slug, image)}
              onDelete={(image, position) => setPendingDelete({ slug, image, position })}
              onSaveAlt={(image, value) => handleSaveAlt(slug, image, value)}
              sectionRef={(el) => {
                sectionRefs.current[slug] = el;
              }}
            />
          ))}
        </div>
      )}

      {/* Unsaved-changes bar — nothing above hits the live site until Save. */}
      {dirtyCount > 0 && (
        <div className="sticky bottom-4 z-10 mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-primary/30 bg-white px-4 py-3 shadow-lg">
            <p className="font-poppins text-sm text-brand-text">
              <i className="pi pi-pencil mr-2 text-brand-primary" aria-hidden="true" />
              <strong className="font-semibold">
                {dirtyCount} unsaved {dirtyCount === 1 ? "change" : "changes"}.
              </strong>{" "}
              <span className="text-brand-text/60">The live site still shows the old version.</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                disabled={saving}
                className="rounded-lg border border-brand-divider px-4 py-2 font-arvo-bold text-sm text-brand-text transition-colors hover:bg-brand-secondary cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void saveAll()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-2 font-arvo-bold text-sm text-white transition-colors hover:bg-brand-primary/90 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-60"
              >
                {saving && <i className="pi pi-spinner pi-spin text-xs" aria-hidden="true" />}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete photo ${pendingDelete?.position ?? ""}?`}
        message={
          <>
            This removes the photo from <strong>{titleFor(pendingDelete?.slug ?? "")}</strong> and
            deletes its file permanently.
            <br />
            <span className="text-brand-text/50">This can&rsquo;t be undone.</span>
          </>
        }
        confirmLabel="Delete photo"
        onConfirm={() => void performDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard unsaved changes?"
        message={
          <>
            This reverts <strong>{dirtyCount}</strong> unsaved{" "}
            {dirtyCount === 1 ? "change" : "changes"} back to what the live site currently shows.
          </>
        }
        confirmLabel="Discard changes"
        onConfirm={discardAll}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
};

export default AdminCarousels;
