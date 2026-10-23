// Write a small WebP thumb beside every dish photo that doesn't have one yet.
//
// The storefront derives a thumb's URL from the photo's (items/<uuid>.png ->
// items/<uuid>_thumb.webp, see apps/web/src/utils/thumbs.ts) and falls back to
// the original when the thumb is missing, so this is safe to run any time and
// re-running only fills gaps. ADDITIVE: never overwrites or deletes anything.
//
//   node scripts/backfill-menu-thumbs.mjs            # dry run: what would be written
//   node scripts/backfill-menu-thumbs.mjs --apply    # write the thumbs
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.  Needs sharp (root devDependency).
import sharp from "sharp";
import { BUCKET, requireEnv, encodePath, kb, mb, sleep } from "./lib/image-migration.mjs";

const env = requireEnv();
const APPLY = process.argv.includes("--apply");

/** Must match THUMB_EDGE and the encoder settings in apps/web. */
const EDGE = 640;
const QUALITY = 72;
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const ITEMS = `/storage/v1/object/public/${BUCKET}/items/`;

const thumbPathFor = (p) => p.replace(/\.[^./]+$/, "") + "_thumb.webp";
const headers = { authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, apikey: env.SERVICE_ROLE_KEY };

async function dishPhotoPaths() {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/menu_items?select=image_url&image_url=not.is.null`, { headers });
  if (!res.ok) throw new Error(`menu_items: ${res.status} ${await res.text()}`);
  const urls = (await res.json()).map((r) => r.image_url.split("?")[0]);
  return [...new Set(urls.filter((u) => u.includes(ITEMS) && !u.endsWith("_thumb.webp")))].map(
    (u) => `items/${decodeURIComponent(u.split(ITEMS)[1])}`,
  );
}

const publicUrl = (p) => `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodePath(p)}`;

async function exists(p) {
  const res = await fetch(publicUrl(p), { method: "HEAD" });
  return res.ok;
}

async function upload(p, body) {
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodePath(p)}`, {
    method: "POST",
    headers: { ...headers, "content-type": "image/webp", "cache-control": CACHE_CONTROL, "x-upsert": "false" },
    body,
  });
  if (res.ok) return "written";
  const text = await res.text().catch(() => "");
  // Storage reports a duplicate as 409, or as 400 carrying statusCode "409".
  if (res.status === 409 || /"statusCode":\s*"409"|already exists/i.test(text)) return "exists";
  throw new Error(`upload ${p}: ${res.status} ${text.slice(0, 200)}`);
}

const paths = await dishPhotoPaths();
console.log(`${paths.length} dish photos. ${APPLY ? "APPLYING" : "dry run (pass --apply to write)"}`);

let written = 0, skipped = 0, failed = 0, inBytes = 0, outBytes = 0;
for (const src of paths) {
  const thumb = thumbPathFor(src);
  try {
    if (await exists(thumb)) {
      skipped++;
      continue;
    }
    const res = await fetch(publicUrl(src));
    if (!res.ok) throw new Error(`download ${src}: ${res.status}`);
    const original = Buffer.from(await res.arrayBuffer());
    // failOn "none": a truncated upload still gets a thumb of what browsers can show of it.
    const out = await sharp(original, { failOn: "none" })
      .rotate()
      .resize({ width: EDGE, height: EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
    inBytes += original.length;
    outBytes += out.length;
    if (APPLY) {
      const result = await upload(thumb, out);
      if (result === "exists") skipped++;
      else written++;
      await sleep(100);
    } else {
      written++;
    }
    console.log(`${APPLY ? "wrote" : "would write"} ${thumb}  ${kb(original.length)} kB -> ${kb(out.length)} kB`);
  } catch (e) {
    failed++;
    console.error(`FAILED ${src}: ${e.message}`);
  }
}
console.log(
  `\n${APPLY ? "written" : "would write"}: ${written}  already there: ${skipped}  failed: ${failed}` +
    `  originals ${mb(inBytes)} MB -> thumbs ${mb(outBytes)} MB`,
);
if (failed) process.exitCode = 1;
