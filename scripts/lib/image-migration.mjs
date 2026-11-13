// Shared plumbing for the three menu-images migration scripts.
//
// Everything that has to agree across optimise → update-references → delete lives
// here, so a fact like "services is keyed by slug, not id" is written once.
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const BUCKET = "menu-images";
const PAGE = 100;

/** Below this a re-encode trades visible quality for a saving too small to matter. */
export const SKIP_UNDER = 120 * 1024;
/** Manifest statuses meaning the optimiser is done with a file — converted, or left lean on purpose. */
export const HANDLED = new Set(["verified", "skipped-lean"]);

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MANIFEST_PATH = path.join(HERE, "..", "image-migration-manifest.json");
export const BACKUP_PATH = path.join(HERE, "..", "image-reference-backup.json");

/**
 * Every column that can hold a reference to an object in the bucket.
 *
 * `kind` says what the column stores — a full public URL or the bare object key.
 * `pk` is the column updates are keyed on: menu_items and carousel_images use
 * `id`, but services is keyed by `slug` and has no id at all.
 */
export const TARGETS = [
  { table: "menu_items", pk: "id", column: "image_url", kind: "url" },
  { table: "carousel_images", pk: "id", column: "image_url", kind: "url" },
  { table: "carousel_images", pk: "id", column: "storage_path", kind: "key" },
  { table: "services", pk: "slug", column: "image_url", kind: "url" },
  { table: "services", pk: "slug", column: "storage_path", kind: "key" },
];

export function requireEnv() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing env. Both are required:\n" +
        "  SUPABASE_URL=https://<ref>.supabase.co\n" +
        "  SUPABASE_SERVICE_ROLE_KEY=<service role key>\n\n" +
        "The service role key bypasses RLS — keep it out of shell history and never ship it to a client.",
    );
    process.exit(1);
  }
  return { SUPABASE_URL: url, SERVICE_ROLE_KEY: key };
}

export function makeClient({ SUPABASE_URL, SERVICE_ROLE_KEY }) {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const mb = (b) => (b / 1024 / 1024).toFixed(1);
export const kb = (b) => (b / 1024).toFixed(0);

export const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");
export const webpPathFor = (p) => p.replace(/\.[^./]+$/, "") + ".webp";
export const isWebp = (p) => /\.webp$/i.test(p);
export const isGif = (p) => /\.gif$/i.test(p);

/**
 * storage-js puts the HTTP status in `statusCode` as a STRING and in `status` as a
 * number; native fetch gives a number. Normalise, or `=== 429` and `=== 402` never
 * match on the download path.
 */
export const httpStatus = (err) => {
  const n = Number(err?.status ?? err?.statusCode);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * The object key a column value points at, or null.
 *
 * getPublicUrl() runs encodeURI over the key when it builds a URL, so a key with a
 * space or `#` in it is stored percent-encoded — decode before comparing against
 * the raw names Storage lists. Every key today is <folder>/<uuid>.<ext>, so this
 * is a no-op in practice, but the delete gate must never miss on it.
 */
export function keyFromValue(value, kind) {
  if (!value) return null;
  const raw =
    kind === "url"
      ? (value.match(new RegExp(`/${BUCKET}/([^?#]+)`)) ?? [])[1]
      : value.replace(/^\/+/, "");
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export const publicUrl = (supabaseUrl, key) =>
  `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${encodePath(key)}`;

/**
 * Walk the bucket. Supabase returns prefixes as entries with a null id, and the real
 * objects live under carousel/<slug>/ and services/<slug>/ — a flat list finds none.
 * `onError` lets the caller wrap each page in its own retry policy.
 */
export async function listRecursive(storage, prefix, { list = (p, o) => storage.list(p, o) } = {}, out = []) {
  let offset = 0;
  for (;;) {
    const { data, error } = await list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw Object.assign(new Error(`list ${prefix || "/"}: ${error.message}`), { status: httpStatus(error) });
    if (!data?.length) break;

    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        await listRecursive(storage, full, { list }, out);
      } else {
        out.push({ path: full, size: entry.metadata?.size ?? 0, mimetype: entry.metadata?.mimetype ?? "" });
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

/**
 * Read every referencing row once per table — five small reads, not one per file.
 * Returns Map<table, rows>, each row carrying its pk and reference columns.
 */
export async function readReferenceRows(supabase) {
  const rows = new Map();
  for (const table of [...new Set(TARGETS.map((t) => t.table))]) {
    const targets = TARGETS.filter((t) => t.table === table);
    const columns = [...new Set([targets[0].pk, ...targets.map((t) => t.column)])];
    const { data, error } = await supabase.from(table).select(columns.join(","));
    if (error) throw new Error(`read ${table}: ${error.message}`);
    rows.set(table, data ?? []);
  }
  return rows;
}

/** items/abc.png -> items/abc_thumb.webp. Must match apps/web/src/utils/thumbs.ts. */
export const thumbKeyFor = (key) => key.replace(/\.[^./]+$/, "") + "_thumb.webp";

/**
 * Every object key the database currently points at, across all TARGETS —
 * plus each dish photo's thumb. Thumbs are found by NAME (never stored in a
 * column), so without this the orphan sweep would delete every one of them.
 */
export async function referencedKeys(supabase) {
  const keys = new Set();
  const rows = await readReferenceRows(supabase);
  for (const target of TARGETS) {
    for (const row of rows.get(target.table)) {
      const key = keyFromValue(row[target.column], target.kind);
      if (!key) continue;
      keys.add(key);
      if (key.startsWith("items/")) keys.add(thumbKeyFor(key));
    }
  }
  return keys;
}

/**
 * Load the manifest. A missing file is a first run (returns null). A file that
 * exists but won't parse is a half-written one from a crash — refuse rather than
 * start over and forget which objects are already uploaded.
 */
export async function loadManifest() {
  let raw;
  try {
    raw = await readFile(MANIFEST_PATH, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
  try {
    const parsed = JSON.parse(raw);
    return { ...parsed, entries: parsed.entries ?? [] };
  } catch (e) {
    console.error(
      `Manifest at ${MANIFEST_PATH} is not valid JSON (${e.message}).\n` +
        "It records which objects are already uploaded; refusing to discard that. Repair or move it, then re-run.",
    );
    process.exit(1);
  }
}
