import React, { useEffect, useRef, useState } from "react";
import ServicePanel from "../ServicePanel/ServicePanel";
import { SERVICE_ICONS, iconById, type ServiceIconId } from "../../constants/serviceIcons";
import { invalidateServices, useServices, type Service } from "../../hooks/useServices";
import {
  removeServiceImage,
  updateService,
  uploadServiceImage,
} from "../../services/servicesService";

/**
 * Name, glyph, homepage photo and on/off switch for one service.
 *
 * Everything here writes to public.services and reaches the live site on the
 * visitor's next page load. The photo goes to Storage first so a failed upload
 * can never leave the row pointing at a file that isn't there.
 */

const label = "block font-poppins text-xs font-semibold uppercase tracking-wide text-brand-text/70";
const field =
  "mt-1.5 w-full min-h-[44px] rounded-lg border border-brand-divider bg-white px-3 " +
  "font-poppins text-sm text-brand-text transition-colors " +
  "focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40";

const ServiceIdentityForm: React.FC<{ service: Service }> = ({ service }) => {
  const { services } = useServices();

  const [name, setName] = useState(service.name);
  const [pageTitle, setPageTitle] = useState(service.pageTitle);
  const [description, setDescription] = useState(service.description);
  const [iconId, setIconId] = useState<ServiceIconId>(service.icon);
  const [isActive, setIsActive] = useState(service.isActive);
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Re-seed the draft whenever the underlying row changes: switching services,
  // and the refetch that follows a save.
  useEffect(() => {
    setName(service.name);
    setPageTitle(service.pageTitle);
    setDescription(service.description);
    setIconId(service.icon);
    setIsActive(service.isActive);
    setPending(null);
    setError(null);
  }, [service]);

  // Object URLs leak until revoked. The cleanup closes over the value being
  // replaced, so it covers both a new pick and unmount.
  useEffect(
    () => () => {
      if (pending) URL.revokeObjectURL(pending.url);
    },
    [pending],
  );

  const pickFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setPending({ file, url: URL.createObjectURL(file) });
  };

  // The homepage needs at least one orderable panel, so the last one standing
  // can't switch itself off.
  const otherActiveOrderable = services.filter(
    (s) => s.kind === "orderable" && s.isActive && s.slug !== service.slug,
  ).length;
  const lockedOn = service.kind === "orderable" && isActive && otherActiveOrderable === 0;

  const blank = name.trim() === "" || pageTitle.trim() === "";
  const dirty =
    name !== service.name ||
    pageTitle !== service.pageTitle ||
    description !== service.description ||
    iconId !== service.icon ||
    isActive !== service.isActive ||
    pending !== null;

  const save = async () => {
    if (saving || !dirty || blank) return;
    setSaving(true);
    setError(null);
    let uploaded: { image_url: string; storage_path: string } | null = null;
    try {
      if (pending) uploaded = await uploadServiceImage(service.slug, pending.file);

      await updateService(service.slug, {
        name: name.trim(),
        page_title: pageTitle.trim(),
        description: description.trim(),
        icon_id: iconId,
        is_active: isActive,
        ...(uploaded ?? {}),
      });

      // Only once the row points at the new file is the old one safe to drop,
      // and only best-effort: an orphaned file beats a live panel with no photo.
      if (uploaded && service.storagePath) {
        await removeServiceImage(service.storagePath).catch(() => {});
      }

      setPending(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      invalidateServices();
    } catch (e) {
      // The row never got the new URL, so the file just uploaded is garbage.
      if (uploaded) await removeServiceImage(uploaded.storage_path).catch(() => {});
      setError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const Chosen = iconById(iconId);

  return (
    <section
      aria-label="Service details"
      className="rounded-xl border border-brand-divider bg-white p-5 shadow-sm sm:p-6"
    >
      {error && (
        <p
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 font-poppins text-xs leading-relaxed text-red-700"
        >
          <i className="pi pi-exclamation-circle mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {/* On/off first: it decides whether anything below it is visible at all. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-divider bg-brand-secondary/40 px-4 py-3">
        <div className="min-w-0">
          <p className="font-arvo-bold text-sm text-brand-text">Show on the homepage</p>
          <p className="mt-0.5 font-poppins text-xs text-brand-text/70">
            {lockedOn
              ? "This is the only service left on the homepage, so it can't be switched off."
              : isActive
                ? "Visitors see this service's panel."
                : "Hidden. The remaining panels spread out to fill the space."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          aria-label="Show on the homepage"
          disabled={lockedOn}
          title={lockedOn ? "At least one service must stay on the homepage" : undefined}
          onClick={() => setIsActive((v) => !v)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            isActive ? "bg-brand-primary" : "bg-brand-divider"
          } ${lockedOn ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        >
          <span
            className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              isActive ? "translate-x-[1.375rem]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <div>
            <label htmlFor="svc-name" className={label}>
              Name on the homepage
            </label>
            <input
              id="svc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
              aria-describedby="svc-name-help"
            />
            <p id="svc-name-help" className="mt-1.5 font-poppins text-xs text-brand-text/70">
              The label across the photo panel visitors land on.
            </p>
          </div>

          <div>
            <label htmlFor="svc-title" className={label}>
              Heading on the service page
            </label>
            <input
              id="svc-title"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              className={field}
              aria-describedby="svc-title-help"
            />
            <p id="svc-title-help" className="mt-1.5 font-poppins text-xs text-brand-text/70">
              Shown at the top of <span className="tabular-nums">/services/{service.slug}</span>.
              It can differ from the homepage name.
            </p>
          </div>

          <div>
            <label htmlFor="svc-desc" className={label}>
              Description
            </label>
            <textarea
              id="svc-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${field} resize-y py-2 leading-relaxed`}
              aria-describedby="svc-desc-help"
            />
            <p id="svc-desc-help" className="mt-1.5 font-poppins text-xs text-brand-text/70">
              The copy that opens on the homepage panel. Leave it empty to fall back
              to the wording built into the site.
            </p>
          </div>

          <fieldset>
            <legend className={label}>Icon</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SERVICE_ICONS.map(({ id, label: iconLabel, Icon }) => {
                const active = id === iconId;
                return (
                  <label
                    key={id}
                    title={iconLabel}
                    className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg border-2 transition-colors focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2 ${
                      active
                        ? "border-brand-primary bg-brand-primary text-white"
                        : "border-brand-divider bg-white text-brand-text/60 hover:border-brand-primary/50 hover:text-brand-text"
                    }`}
                  >
                    <input
                      type="radio"
                      name="service-icon"
                      value={id}
                      checked={active}
                      onChange={() => setIconId(id)}
                      className="sr-only"
                    />
                    <Icon className="h-6 w-6" />
                    <span className="sr-only">{iconLabel}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div>
          <span className={label}>Main photo</span>
          <p className="mt-1.5 font-poppins text-xs text-brand-text/70">
            Fills the homepage panel behind the name.
          </p>

          {/*
            The real homepage panel, not a lookalike: same scrim, glyph and
            hover reveal, so what you approve here is what ships. Portrait to
            match its shape on the homepage, where it is one of the full-height
            columns.
          */}
          <div className="mt-2 aspect-[3/5] overflow-hidden rounded-lg border border-brand-divider">
            <ServicePanel
              preview
              icon={Chosen}
              service={{
                ...service,
                name: name || service.name,
                description: description || service.description,
                image: pending?.url ?? service.image,
              }}
            />
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(e) => {
              pickFile(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-brand-divider bg-white px-4 font-arvo-bold text-sm text-brand-text transition-colors hover:border-brand-primary/50 hover:bg-brand-secondary cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <i className="pi pi-upload text-xs" aria-hidden="true" />
            {service.imageUrl ? "Replace photo" : "Choose a photo"}
          </button>
          {pending && (
            <p className="mt-1.5 font-poppins text-xs text-brand-text/70">
              Not uploaded yet. Save to publish it.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-brand-divider pt-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || blank || saving}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-primary px-5 font-arvo-bold text-sm text-white transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          {saving && <i className="pi pi-spinner pi-spin text-xs" aria-hidden="true" />}
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
        <span className="font-poppins text-xs text-brand-text/70">
          {blank
            ? "The name and the page heading can't be empty."
            : "Changes reach a visitor the next time they load the site."}
        </span>
      </div>
    </section>
  );
};

export default ServiceIdentityForm;
