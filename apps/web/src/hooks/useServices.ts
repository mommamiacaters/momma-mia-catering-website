// The five service pages, merged from public.services over the bundled
// constants.
//
// The constants stay the floor: they carry the description (not editable yet)
// and the bundled photo that `image_url = null` means. So a failed fetch, or a
// table that hasn't been seeded, still renders the site exactly as it shipped
// instead of a blank homepage.
import { useCallback, useEffect, useState } from "react";
import { ADMIN_SERVICES, type AdminService } from "../constants/adminServices";
import { SERVICE_ICONS, type ServiceIconId } from "../constants/serviceIcons";
import { listServices, type ServiceRecord } from "../services/servicesService";

export interface Service extends AdminService {
  isActive: boolean;
  sortOrder: number;
  /** The uploaded photo, or null when `image` is the bundled one. */
  imageUrl: string | null;
  storagePath: string | null;
}

const isKnownIcon = (id: string): id is ServiceIconId =>
  SERVICE_ICONS.some((o) => o.id === id);

/** Constants only. What the site looks like with no rows and no network. */
const fallback = (): Service[] =>
  ADMIN_SERVICES.map((s, i) => ({
    ...s,
    isActive: true,
    sortOrder: i,
    imageUrl: null,
    storagePath: null,
  }));

const merge = (rows: ServiceRecord[]): Service[] => {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return ADMIN_SERVICES.map((base, i): Service => {
    const row = bySlug.get(base.slug);
    if (!row) return { ...base, isActive: true, sortOrder: i, imageUrl: null, storagePath: null };
    return {
      ...base,
      name: row.name,
      pageTitle: row.page_title,
      // Blank falls back rather than rendering an empty gap on the panel.
      description: row.description?.trim() ? row.description : base.description,
      // An unknown glyph id (a hand-edited row, or one from a newer build)
      // falls back rather than rendering nothing.
      icon: isKnownIcon(row.icon_id) ? row.icon_id : base.icon,
      image: row.image_url ?? base.image,
      imageUrl: row.image_url,
      storagePath: row.storage_path,
      kind: row.kind,
      isActive: row.is_active,
      sortOrder: row.sort_order,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
};

let cache: Service[] | null = null;
let inflight: Promise<Service[]> | null = null;
// Bumped on every invalidation. A request that started before the bump must not
// write its result: without this, a fetch begun before an admin save can land
// after the post-save fetch and overwrite fresh rows with pre-save ones, so the
// sidebar and the form snap back to the old name until something else reloads.
let generation = 0;
const subscribers = new Set<() => void>();

/** Drop the cache and re-render every mounted consumer. Call after an admin save. */
export function invalidateServices(): void {
  cache = null;
  inflight = null;
  generation += 1;
  subscribers.forEach((fn) => fn());
}

function load(): Promise<Service[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    const startedAt = generation;
    inflight = listServices()
      .then((rows) => {
        const merged = merge(rows);
        if (startedAt === generation) {
          cache = merged;
          inflight = null;
        }
        return merged;
      })
      .catch((e) => {
        // Release the slot so a later mount can retry instead of being pinned
        // to one blip for the whole session.
        if (startedAt === generation) inflight = null;
        throw e;
      });
  }
  return inflight;
}

export interface UseServices {
  services: Service[];
  loading: boolean;
  error: boolean;
  refresh: () => void;
}

export function useServices(): UseServices {
  const [services, setServices] = useState<Service[]>(cache ?? fallback());
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setError(false);
    setLoading(!cache);
    load()
      .then((s) => {
        if (!active) return;
        setServices(s);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setServices(fallback());
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  useEffect(() => {
    const bump = () => setNonce((n) => n + 1);
    subscribers.add(bump);
    return () => {
      subscribers.delete(bump);
    };
  }, []);

  const refresh = useCallback(() => invalidateServices(), []);

  return { services, loading, error, refresh };
}
