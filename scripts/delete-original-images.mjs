// Delete the original images, once the .webp copies have replaced them.
//
// Step 3 of 3, and the only destructive script in the set. It refuses to delete
// anything that has not passed all three gates:
//
//   1. the manifest records a VERIFIED .webp conversion for it
//   2. that .webp object still exists in the bucket right now (re-checked live,
//      not trusted from the manifest)
//   3. no row in menu_items / carousel_images / services still references it
//
// Gate 3 is the one that matters: it re-queries the database at delete time, so if
// update-image-references.mjs was skipped, half-completed, or rolled back, this
// script stops instead of taking the site's images down.
//
//   node scripts/delete-original-images.mjs             # dry run, default
//   node scripts/delete-original-images.mjs --apply     # delete the originals
//   node scripts/delete-original-images.mjs --orphans   # list unreferenced objects
//   node scripts/delete-original-images.mjs --orphans --apply
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import {
  BUCKET,
  MANIFEST_PATH,
  requireEnv,
  makeClient,
  sleep,
  mb,
  kb,
  listRecursive,
  referencedKeys,
  loadManifest,
} from "./lib/image-migration.mjs";

const env = requireEnv();
const BATCH = 50;
const DELAY_MS = 200;

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const ORPHANS = argv.includes("--orphans");
const limitIdx = argv.indexOf("--limit");
const LIMIT = limitIdx > -1 ? Number(argv[limitIdx + 1]) || 0 : 0;

const supabase = makeClient(env);
const storage = supabase.storage.from(BUCKET);

async function removeInBatches(paths) {
  let removed = 0;
  for (let i = 0; i < paths.length; i += BATCH) {
    const slice = paths.slice(i, i + BATCH);
    const { data, error } = await storage.remove(slice);
    if (error) {
      console.warn(`x batch ${i / BATCH + 1} — ${error.message}`);
      continue;
    }
    removed += data?.length ?? slice.length;
    console.log(`  removed ${removed}/${paths.length}`);
    await sleep(DELAY_MS);
  }
  return removed;
}

// ---------------------------------------------------------------------------

const live = await listRecursive(storage, "");
const liveByPath = new Map(live.map((f) => [f.path, f]));
const referenced = await referencedKeys(supabase).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
// Loaded in both modes: a missing manifest is fine for --orphans (nothing has been
// migrated yet), but if one exists its paths are migration artifacts, not junk.
const manifest = await loadManifest();

if (ORPHANS) {
  // Objects nothing points at — abandoned uploads and replaced photos that were never
  // cleaned up. A freshly uploaded .webp is ALSO unreferenced until
  // update-image-references.mjs runs, so anything the manifest knows about (either
  // side of a conversion) is excluded: the originals go through the gated path below,
  // and the new copies are the whole point of the migration.
  const migration = new Set((manifest?.entries ?? []).flatMap((e) => [e.from, e.to]).filter(Boolean));
  const orphans = live.filter((f) => !referenced.has(f.path) && !migration.has(f.path));
  const shielded = live.filter((f) => !referenced.has(f.path) && migration.has(f.path)).length;
  const bytes = orphans.reduce((a, f) => a + f.size, 0);

  if (shielded) console.log(`(${shielded} unreferenced object(s) belong to the migration and are excluded)\n`);
  console.log(`${orphans.length} unreferenced object(s), ${mb(bytes)}MB\n`);
  for (const o of orphans.slice(0, 20)) console.log(`  ${o.path}  (${kb(o.size)}kB)`);
  if (orphans.length > 20) console.log(`  ... and ${orphans.length - 20} more`);

  if (!APPLY) {
    console.log("\nDry run. Re-run with --orphans --apply to delete them.");
    process.exit(0);
  }
  if (!orphans.length) process.exit(0);

  console.log("\nDeleting unreferenced objects...");
  const removed = await removeInBatches(orphans.map((o) => o.path));
  console.log(`\n${removed} deleted, ${mb(bytes)}MB reclaimed.`);
  process.exit(0);
}

if (!manifest) {
  console.error(`No manifest at ${MANIFEST_PATH}. Nothing to delete.`);
  process.exit(1);
}

const verified = manifest.entries.filter((e) => e.status === "verified");
if (!verified.length) {
  console.error("Manifest holds no verified conversions — nothing is safe to delete.");
  process.exit(1);
}

const safe = [];
const blocked = [];

for (const entry of verified) {
  if (!liveByPath.has(entry.from)) continue; // already deleted by an earlier run

  if (!liveByPath.has(entry.to)) {
    blocked.push({ ...entry, why: `replacement ${entry.to} is not in the bucket` });
    continue;
  }
  if (referenced.has(entry.from)) {
    blocked.push({ ...entry, why: "database still references this original" });
    continue;
  }
  safe.push({ ...entry, size: liveByPath.get(entry.from).size });
}

const queue = LIMIT ? safe.slice(0, LIMIT) : safe;
const bytes = queue.reduce((a, e) => a + e.size, 0);

console.log(`${verified.length} verified conversion(s)`);
console.log(`  ${safe.length} safe to delete (${mb(safe.reduce((a, e) => a + e.size, 0))}MB)`);
console.log(`  ${blocked.length} blocked`);
console.log(`  ${verified.length - safe.length - blocked.length} already gone\n`);

if (blocked.length) {
  console.log("BLOCKED — these originals are still load-bearing:");
  for (const b of blocked.slice(0, 15)) console.log(`  ! ${b.from}\n      ${b.why}`);
  if (blocked.length > 15) console.log(`  ... and ${blocked.length - 15} more`);
  console.log(
    "\nIf the database still references originals, run:\n" +
      "  node scripts/update-image-references.mjs --apply\n",
  );
}

if (!queue.length) {
  console.log("Nothing to delete.");
  process.exit(blocked.length ? 1 : 0);
}

if (!APPLY) {
  console.log(`Would delete ${queue.length} original(s), reclaiming ${mb(bytes)}MB:`);
  for (const e of queue.slice(0, 15)) console.log(`  - ${e.from}`);
  if (queue.length > 15) console.log(`  ... and ${queue.length - 15} more`);
  console.log("\nDry run — nothing deleted. Re-run with --apply.");
  process.exit(0);
}

console.log(`Deleting ${queue.length} original(s)...`);
const removed = await removeInBatches(queue.map((e) => e.from));

console.log(`\n${"=".repeat(64)}`);
console.log(`${removed} original(s) deleted, ${mb(bytes)}MB reclaimed.`);
if (blocked.length) {
  console.log(`${blocked.length} left in place because they are still referenced or unreplaced.`);
  process.exitCode = 1;
}
