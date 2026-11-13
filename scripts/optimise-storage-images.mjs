// Bulk-optimise the images already sitting in the menu-images bucket.
//
// The bucket holds full-resolution phone photos — 294 objects, ~420MB, 134 of them
// PNGs — behind cards that render at roughly 320x240. That is what blew the egress
// quota. This converts each one to a resized WebP.
//
// NON-DESTRUCTIVE BY DESIGN: every optimised image is uploaded to a NEW .webp path
// and the original is left exactly where it is. Repointing the database and deleting
// the originals are separate, opt-in scripts that read this script's manifest:
//   1. optimise-storage-images.mjs --apply     (this script — writes .webp objects)
//   2. update-image-references.mjs --apply     (repoints menu_items/carousel_images/services)
//   3. delete-original-images.mjs --apply      (removes the originals, last)
//
//   node scripts/optimise-storage-images.mjs                   # dry run, 12 per folder
//   node scripts/optimise-storage-images.mjs --dry-run --full  # measure every file
//   node scripts/optimise-storage-images.mjs --apply           # convert + upload
//   node scripts/optimise-storage-images.mjs --apply --limit 5 # small batch to spot-check
//   node scripts/optimise-storage-images.mjs --apply --only items/
//
// Re-running resumes: anything already uploaded and verified is skipped, so an
// interrupted run (or a quota block mid-way) costs nothing to pick back up.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.  Needs sharp (root devDependency).
import sharp from "sharp";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {
  BUCKET,
  MANIFEST_PATH,
  requireEnv,
  makeClient,
  sleep,
  mb,
  kb,
  encodePath,
  webpPathFor,
  isWebp,
  isGif,
  httpStatus,
  listRecursive,
  loadManifest,
  SKIP_UNDER,
  HANDLED,
} from "./lib/image-migration.mjs";

const env = requireEnv();

/** Longest edge to keep. Menu cards render ~320px wide; 1600 covers 2x on a large screen. */
const MAX_EDGE = 1600;
const QUALITY = 78;
/** Set via a raw header — the SDK rewrites `cacheControl` into `max-age=<value>`, which would mangle this. */
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const DELAY_MS = 200;
const MAX_ATTEMPTS = 4;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name, fallback) => {
  const i = argv.indexOf(name);
  return i > -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const APPLY = flag("--apply");
const FULL = flag("--full");
const ONLY = value("--only", "").replace(/^\/+|\/+$/g, "");
const LIMIT = Number(value("--limit", "0")) || 0;
const SAMPLE = Number(value("--sample", "12")) || 12;
const DELAY = Number(value("--delay", String(DELAY_MS)));

const supabase = makeClient(env);
const storage = supabase.storage.from(BUCKET);

/**
 * Retry only what is worth retrying: network faults, 429, and 5xx. A 402 (quota
 * restriction) or 403 is terminal — retrying just burns time and more requests.
 */
async function withRetry(label, fn) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const status = httpStatus(e);
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      const backoff = 500 * 2 ** (attempt - 1);
      console.warn(`  retry ${attempt}/${MAX_ATTEMPTS - 1} ${label} in ${backoff}ms — ${e.message}`);
      await sleep(backoff);
    }
  }
  throw lastError;
}

/** Confirm the object really landed, at the size we think it is. */
async function verifyObject(objectPath, expectedBytes) {
  const dir = objectPath.includes("/") ? objectPath.slice(0, objectPath.lastIndexOf("/")) : "";
  const base = objectPath.slice(objectPath.lastIndexOf("/") + 1);
  // search is a substring match, so leave headroom rather than trusting the
  // first hit to be the exact name.
  const { data, error } = await storage.list(dir, { limit: 10, search: base });
  if (error) throw new Error(`verify ${objectPath}: ${error.message}`);
  const found = data?.find((f) => f.name === base);
  if (!found) return { ok: false, reason: "not found after upload" };
  const size = found.metadata?.size ?? 0;
  if (size !== expectedBytes) {
    return { ok: false, reason: `size mismatch: expected ${expectedBytes}, storage has ${size}` };
  }
  return { ok: true, size };
}

/**
 * Raw fetch rather than storage-js: the SDK formats its cacheControl option as
 * `max-age=<value>`, so the "public, ..., immutable" directives can only be set
 * by writing the header ourselves.
 */
async function uploadWebp(objectPath, body) {
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodePath(objectPath)}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.SERVICE_ROLE_KEY}`,
      apikey: env.SERVICE_ROLE_KEY,
      "content-type": "image/webp",
      "cache-control": CACHE_CONTROL,
      "x-upsert": "false", // never clobber; a collision means we already did this file
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Storage has reported a duplicate key as HTTP 409 and as HTTP 400 carrying
    // statusCode "409" in the body, depending on version. Normalise so the
    // collision branch below fires either way.
    const duplicate = res.status === 409 || /"statusCode":\s*"409"|already exists/i.test(text);
    throw Object.assign(new Error(`upload ${objectPath}: ${res.status} ${text.slice(0, 200)}`), {
      status: duplicate ? 409 : res.status,
    });
  }
}

async function downloadObject(objectPath) {
  const { data, error } = await storage.download(objectPath);
  if (error) throw Object.assign(new Error(error.message), { status: httpStatus(error) });
  return Buffer.from(await data.arrayBuffer());
}

/**
 * sharp's prebuilt binaries can't decode iPhone HEIC (HEVC is patent-encumbered,
 * so libheif ships AVIF-only). On macOS, hand those to the built-in `sips` to
 * get a JPEG first; elsewhere the file fails as before and is reported.
 * Detected by the ISO-BMFF "ftyp" brand, not the name.
 */
async function decodable(input) {
  const brand = input.subarray(4, 12).toString("latin1");
  if (!/^ftyp(heic|heix|hevc|hevx|mif1|msf1)/.test(brand) || process.platform !== "darwin") return input;
  const dir = await mkdtemp(path.join(tmpdir(), "heic-"));
  try {
    const src = path.join(dir, "in.heic");
    const out = path.join(dir, "out.jpg");
    await writeFile(src, input);
    await promisify(execFile)("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "95", src, "--out", out]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * resize+webp, and sharp drops all metadata unless asked to keep it — so EXIF, GPS
 * and camera tags go with it. rotate() first, or orientation-flagged photos that
 * relied on that EXIF come out sideways.
 */
async function optimise(input) {
  return sharp(await decodable(input))
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
}

/** Evenly-spaced pick per folder, so a sample spans the bucket rather than its first rows. */
function sampleOf(files, n) {
  const folders = new Map();
  for (const f of files) {
    const key = f.path.split("/")[0];
    folders.set(key, [...(folders.get(key) ?? []), f]);
  }
  const out = [];
  for (const group of folders.values()) {
    const take = Math.min(n, group.length);
    const step = group.length / take;
    for (let i = 0; i < take; i++) out.push(group[Math.floor(i * step)]);
  }
  return out;
}

async function saveManifest(manifest) {
  manifest.updatedAt = new Date().toISOString();
  manifest.settings = { maxEdge: MAX_EDGE, quality: QUALITY, cacheControl: CACHE_CONTROL };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------------

const all = await listRecursive(storage, "", {
  list: (p, o) =>
    withRetry(`list ${p || "/"}`, async () => {
      const r = await storage.list(p, o);
      if (r.error) throw Object.assign(new Error(r.error.message), { status: httpStatus(r.error) });
      return r;
    }),
});
const scoped = ONLY ? all.filter((f) => f.path.startsWith(`${ONLY}/`) || f.path.startsWith(ONLY)) : all;

const manifest = (await loadManifest()) ?? { bucket: BUCKET, startedAt: new Date().toISOString(), entries: [] };
const byFrom = new Map(manifest.entries.map((e) => [e.from, e]));

// Two originals that differ only by extension (x.jpg and x.png) would both target
// x.webp, and whichever uploaded second would be recorded against the first one's
// picture. Likewise an x.webp that was ALREADY in the bucket as its own original.
// Refuse up front rather than sort it out after a delete. A .webp this script
// wrote on a previous run is expected and is not a collision.
const ourTargets = new Set(manifest.entries.map((e) => e.to).filter(Boolean));
const livePaths = new Set(scoped.map((f) => f.path));
const byTarget = new Map();
for (const f of scoped) {
  if (isWebp(f.path) || isGif(f.path)) continue;
  const t = webpPathFor(f.path);
  byTarget.set(t, [...(byTarget.get(t) ?? []), f.path]);
}
const collisions = [];
for (const [t, sources] of byTarget) {
  if (sources.length > 1) collisions.push([t, sources]);
  else if (livePaths.has(t) && !ourTargets.has(t)) collisions.push([t, [...sources, `${t} (pre-existing original)`]]);
}
if (collisions.length) {
  console.error(`${collisions.length} target path(s) are claimed by more than one object — rename or remove one of each before running:`);
  for (const [t, sources] of collisions.slice(0, 20)) console.error(`  ${t}  <-  ${sources.join(", ")}`);
  process.exit(1);
}

// Already-WebP objects have no rename to perform, and re-encoding them in place would
// mean overwriting an original — the one thing this script must never do. GIFs are
// left alone too: sharp reads only the first frame, so an animation would be
// flattened and, once the original is deleted, unrecoverable.
const alreadyWebp = scoped.filter((f) => isWebp(f.path));
const gifs = scoped.filter((f) => isGif(f.path));
const convertible = scoped.filter((f) => !isWebp(f.path) && !isGif(f.path));
const tooSmall = convertible.filter((f) => f.size < SKIP_UNDER);
const candidates = convertible.filter((f) => f.size >= SKIP_UNDER);

const upsertEntry = (entry) => {
  const existing = byFrom.get(entry.from);
  if (existing) Object.assign(existing, entry);
  else {
    manifest.entries.push(entry);
    byFrom.set(entry.from, entry);
  }
};

const doneAlready = candidates.filter((f) => HANDLED.has(byFrom.get(f.path)?.status));
const pending = candidates.filter((f) => !HANDLED.has(byFrom.get(f.path)?.status));

let queue = APPLY || FULL ? pending : sampleOf(pending, SAMPLE);
if (LIMIT) queue = queue.slice(0, LIMIT);

const pullBytes = queue.reduce((a, f) => a + f.size, 0);
console.log(
  `${all.length} objects in ${BUCKET}${ONLY ? ` (scoped to ${ONLY})` : ""}\n` +
    `  ${candidates.length} convertible · ${alreadyWebp.length} already webp · ${tooSmall.length} under ${kb(SKIP_UNDER)}kB` +
    (gifs.length ? ` · ${gifs.length} gif (left alone)` : "") +
    `\n  ${doneAlready.length} already handled in a previous run\n` +
    `${APPLY ? "APPLYING" : "DRY RUN"} over ${queue.length} file(s) — pulls ${mb(pullBytes)}MB of egress.\n`,
);

if (!queue.length) {
  console.log("Nothing to do.");
  process.exit(0);
}

const stats = new Map();
const record = (p, from, to) => {
  const key = p.split("/")[0];
  const s = stats.get(key) ?? { before: 0, after: 0 };
  stats.set(key, { before: s.before + from, after: s.after + to });
};

let converted = 0;
let skipped = 0;
let failed = 0;

for (const [index, file] of queue.entries()) {
  const target = webpPathFor(file.path);
  const position = `[${String(index + 1).padStart(3)}/${queue.length}]`;
  // Hoisted so the collision handler below can verify against the real byte count.
  let output;

  try {
    const input = await withRetry(`download ${file.path}`, () => downloadObject(file.path));
    output = await optimise(input);

    // A photo that is already leaner than our re-encode gains nothing but a second
    // copy in the bucket. Record it so the next run doesn't download it again.
    if (output.length >= file.size) {
      record(file.path, file.size, file.size);
      skipped++;
      console.log(`${position} = ${file.path} — already lean (${kb(file.size)}kB), left alone`);
      if (APPLY) {
        upsertEntry({ from: file.path, to: null, fromBytes: file.size, toBytes: null, status: "skipped-lean", verifiedAt: null, error: null });
        await saveManifest(manifest);
      }
      continue;
    }

    const saving = (100 - (output.length / file.size) * 100).toFixed(0);
    console.log(
      `${position} ${APPLY ? "→" : "·"} ${file.path}\n` +
        `        ${kb(file.size)}kB → ${kb(output.length)}kB  (−${saving}%)  ${APPLY ? `as ${target}` : ""}`,
    );

    if (APPLY) {
      await withRetry(`upload ${target}`, () => uploadWebp(target, output));

      const check = await withRetry(`verify ${target}`, () => verifyObject(target, output.length));
      if (!check.ok) throw new Error(`verification failed — ${check.reason}`);

      upsertEntry({
        from: file.path,
        to: target,
        fromBytes: file.size,
        toBytes: output.length,
        status: "verified",
        verifiedAt: new Date().toISOString(),
        error: null,
      });
      // Persist per file: a crash or a mid-run quota block must not lose the record
      // of objects that are already in the bucket.
      await saveManifest(manifest);
      await sleep(DELAY);
    }

    record(file.path, file.size, output.length);
    converted++;
  } catch (e) {
    const status = httpStatus(e);

    // An upload collision means a previous run already wrote this file. Treat it as
    // done only if what is there matches what we would have written.
    if (status === 409 && output) {
      const check = await verifyObject(target, output.length).catch((err) => ({ ok: false, reason: err.message }));
      if (check.ok) {
        upsertEntry({
          from: file.path,
          to: target,
          fromBytes: file.size,
          toBytes: check.size,
          status: "verified",
          verifiedAt: new Date().toISOString(),
          error: null,
        });
        await saveManifest(manifest);
        record(file.path, file.size, check.size);
        converted++;
        console.log(`${position} = ${target} already present, verified`);
        continue;
      }
      e = new Error(`${target} exists but does not match this encode — ${check.reason}`);
    }

    failed++;
    record(file.path, file.size, file.size); // a failure saved nothing; don't report it as a win
    upsertEntry({
      from: file.path,
      to: target,
      fromBytes: file.size,
      toBytes: null,
      status: "failed",
      verifiedAt: null,
      error: e.message,
    });
    if (APPLY) await saveManifest(manifest);

    console.warn(`${position} x ${file.path} — ${e.message}`);
    if (status === 402) {
      console.error(
        "\n402 Payment Required — the project is quota-restricted and the Storage API is refusing requests.\n" +
          "Progress so far is saved in the manifest; re-run this exact command once the project is unblocked.",
      );
      break;
    }
  }
}

// ---------------------------------------------------------------------------

const measured = [...stats.values()].reduce(
  (a, s) => ({ before: a.before + s.before, after: a.after + s.after }),
  { before: 0, after: 0 },
);
const pct = (from, to) => (from ? (100 - (to / from) * 100).toFixed(1) : "0.0");

console.log(`\n${"=".repeat(64)}`);
console.log(`${converted} converted · ${skipped} left alone · ${failed} failed`);
console.log(`measured   ${mb(measured.before)}MB → ${mb(measured.after)}MB  (−${pct(measured.before, measured.after)}%)`);

if (!APPLY) {
  // Scale each folder's own measured ratio across the files it holds — carousel shots
  // and menu photos compress differently, so a single blended ratio would skew this.
  let from = 0;
  let to = 0;
  for (const f of candidates) {
    const s = stats.get(f.path.split("/")[0]);
    const ratio = s?.before ? s.after / s.before : 1;
    from += f.size;
    to += f.size * ratio;
  }
  const untouched = [...alreadyWebp, ...gifs, ...tooSmall].reduce((a, f) => a + f.size, 0);
  console.log(`projected  ${mb(from)}MB → ${mb(to)}MB  (−${pct(from, to)}%) across ${candidates.length} convertible files`);
  console.log(`bucket     ${mb(from + untouched)}MB → ${mb(to + untouched)}MB  (−${pct(from + untouched, to + untouched)}% overall)`);
  console.log("\nDry run — nothing was written. Re-run with --apply to upload the .webp copies.");
} else {
  const verified = manifest.entries.filter((e) => e.status === "verified");
  const totalFrom = verified.reduce((a, e) => a + e.fromBytes, 0);
  const totalTo = verified.reduce((a, e) => a + (e.toBytes ?? 0), 0);
  console.log(`manifest   ${verified.length} verified entries → ${path.relative(process.cwd(), MANIFEST_PATH)}`);
  console.log(`cumulative ${mb(totalFrom)}MB → ${mb(totalTo)}MB  (−${pct(totalFrom, totalTo)}%)`);
  console.log(
    "\nOriginals are untouched. Next:\n" +
      "  1. Spot-check a few of the new .webp URLs in a browser.\n" +
      "  2. node scripts/update-image-references.mjs           (dry run)\n" +
      "  3. node scripts/update-image-references.mjs --apply   (repoint the database)\n" +
      "  4. node scripts/delete-original-images.mjs --apply    (only once 2-3 look right)",
  );
}

if (failed) process.exitCode = 1;
