// Repoint the database at the optimised .webp objects.
//
// Step 2 of 3. Run it only after optimise-storage-images.mjs --apply has uploaded and
// verified the new objects, and only before delete-original-images.mjs. Until this
// runs, the site keeps serving the originals — which is the point: nothing breaks
// while the new files are being spot-checked.
//
// Five columns hold these references (see TARGETS in lib/image-migration.mjs), and
// services is keyed by slug rather than id.
//
//   node scripts/update-image-references.mjs            # dry run, shows every change
//   node scripts/update-image-references.mjs --apply    # write them
//   node scripts/update-image-references.mjs --rollback # restore from the backup file
//
// The backup is kept per cell across --apply runs, so a second pass for stragglers
// does not lose the record of the first. Each cell holds the value from just before
// its most recent write — what --rollback restores.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BUCKET,
  MANIFEST_PATH,
  BACKUP_PATH,
  TARGETS,
  SKIP_UNDER,
  HANDLED,
  requireEnv,
  makeClient,
  keyFromValue,
  publicUrl,
  listRecursive,
  readReferenceRows,
  loadManifest,
} from "./lib/image-migration.mjs";

const env = requireEnv();
const APPLY = process.argv.includes("--apply");
const ROLLBACK = process.argv.includes("--rollback");
const supabase = makeClient(env);
const storage = supabase.storage.from(BUCKET);
const kindOf = (c) => TARGETS.find((t) => t.table === c.table && t.column === c.column)?.kind;

const changeKey = (c) => `${c.table}|${c.id}|${c.column}`;

async function loadBackup() {
  try {
    return JSON.parse(await readFile(BACKUP_PATH, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    console.error(`Backup at ${BACKUP_PATH} won't parse (${e.message}). Refusing to continue.`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------

async function rollback() {
  const backup = await loadBackup();
  if (!backup) {
    console.error(`No backup at ${BACKUP_PATH} — nothing to roll back.`);
    process.exit(1);
  }

  console.log(`Restoring ${backup.changes.length} column value(s) recorded across ${backup.runs ?? 1} run(s)\n`);
  // Once delete-original-images.mjs has run, the originals are gone. Pointing a row
  // back at one would swap a working .webp for a 404, so check the bucket first.
  const live = new Set((await listRecursive(storage, "")).map((f) => f.path));
  let restored = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of backup.changes) {
    const originalKey = keyFromValue(c.oldValue, kindOf(c));
    if (originalKey && !live.has(originalKey)) {
      skipped++;
      console.log(`- ${c.table}#${c.id}.${c.column} — original ${originalKey} was deleted, keeping the .webp`);
      continue;
    }
    // Only undo OUR write. If an admin has since replaced this photo the column no
    // longer holds newValue, and restoring the pre-migration value would clobber
    // their newer picture.
    const { data, error } = await supabase
      .from(c.table)
      .update({ [c.column]: c.oldValue })
      .eq(c.pk, c.id)
      .eq(c.column, c.newValue)
      .select(c.pk);
    if (error) {
      failed++;
      console.warn(`x ${c.table}#${c.id}.${c.column} — ${error.message}`);
    } else if (!data?.length) {
      skipped++;
      console.log(`- ${c.table}#${c.id}.${c.column} — no longer holds the migrated value, left as is`);
    } else {
      restored++;
    }
  }

  console.log(`\n${restored} restored, ${skipped} skipped, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

if (ROLLBACK) {
  await rollback();
  process.exit(process.exitCode ?? 0);
}

// ---------------------------------------------------------------------------

const manifest = await loadManifest();
if (!manifest) {
  console.error(`No manifest at ${MANIFEST_PATH}.\nRun: node scripts/optimise-storage-images.mjs --apply`);
  process.exit(1);
}

const verified = manifest.entries.filter((e) => e.status === "verified");
if (!verified.length) {
  console.error("Manifest holds no verified entries — nothing has been uploaded yet.");
  process.exit(1);
}

const unverified = manifest.entries.length - verified.length;
console.log(
  `${verified.length} verified conversion(s) in the manifest` +
    (unverified ? `, ${unverified} not verified (those are left alone)` : "") +
    `\n${APPLY ? "APPLYING" : "DRY RUN"}\n`,
);

// Read every referencing row once per table rather than once per file — five reads,
// not 1200 — and it lets us report references that match nothing in the manifest,
// which a per-file loop would never notice.
const rows = await readReferenceRows(supabase).catch((e) => {
  console.error(e.message);
  process.exit(1);
});

const newByOldPath = new Map(verified.map((e) => [e.from, e.to]));
const statusByPath = new Map(manifest.entries.map((e) => [e.from, e.status]));
// Sizes decide whether the optimiser would ever touch a file, so the warning below
// can tell "not converted yet" apart from "left as-is on purpose".
const sizeByPath = new Map((await listRecursive(storage, "")).map((f) => [f.path, f.size]));
const changes = [];
const unconverted = [];
const missing = [];

for (const target of TARGETS) {
  for (const row of rows.get(target.table)) {
    const current = row[target.column];
    const key = keyFromValue(current, target.kind);
    if (!key) continue;

    const next = newByOldPath.get(key);
    if (!next) {
      const where = `${target.table}.${target.column} → ${key}`;
      if (!sizeByPath.has(key)) missing.push(where);
      else if (
        /\.(jpe?g|png|heic|heif)$/i.test(key) &&
        sizeByPath.get(key) >= SKIP_UNDER &&
        !HANDLED.has(statusByPath.get(key))
      ) {
        // Big enough to convert and not marked lean — the optimiser just hasn't
        // done it yet (or it failed). Small files and skipped-lean are fine as-is.
        unconverted.push(`${where}${statusByPath.get(key) === "failed" ? "  (failed last run)" : ""}`);
      }
      continue;
    }

    changes.push({
      table: target.table,
      pk: target.pk,
      id: row[target.pk],
      column: target.column,
      oldValue: current,
      newValue: target.kind === "url" ? publicUrl(env.SUPABASE_URL, next) : next,
    });
  }
}

// Warnings first: they matter most on the run that finds nothing left to update.
if (unconverted.length) {
  console.log(`${unconverted.length} reference(s) point at a photo the optimiser should convert but hasn't:`);
  for (const u of unconverted.slice(0, 10)) console.log(`  ! ${u}`);
  console.log("  Re-run: node scripts/optimise-storage-images.mjs --apply, then this script again.\n");
}
if (missing.length) {
  console.log(`${missing.length} reference(s) point at an object that is not in the bucket (already broken, unrelated to this run):`);
  for (const m of missing.slice(0, 10)) console.log(`  ? ${m}`);
  console.log("");
}

if (!changes.length) {
  console.log("No references need updating — the database already points at the .webp objects.");
  process.exit(unconverted.length ? 1 : 0);
}

const byColumn = changes.reduce((acc, c) => {
  const k = `${c.table}.${c.column}`;
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});
for (const [col, n] of Object.entries(byColumn)) console.log(`  ${String(n).padStart(4)}  ${col}`);

console.log("\nsample:");
for (const c of changes.slice(0, 3)) {
  console.log(`  ${c.table}#${c.id}.${c.column}`);
  console.log(`    - ${c.oldValue}`);
  console.log(`    + ${c.newValue}`);
}

if (!APPLY) {
  console.log("\nDry run — nothing written. Re-run with --apply.");
  process.exit(0);
}

// Backup first. Supabase's REST API has no multi-statement transaction, so this file
// is the rollback path if an update fails halfway. Merge per cell with any earlier
// backup so a second --apply for stragglers keeps the first run's cells. When a cell
// is written again, the new record wins: its oldValue is what the cell held right
// before this write — possibly an admin's newer photo, which rollback must not skip
// past to a value from an earlier run.
const previous = await loadBackup();
const merged = new Map((previous?.changes ?? []).map((c) => [changeKey(c), c]));
for (const c of changes) merged.set(changeKey(c), c);
await writeFile(
  BACKUP_PATH,
  JSON.stringify(
    {
      takenAt: new Date().toISOString(),
      firstTakenAt: previous?.firstTakenAt ?? new Date().toISOString(),
      runs: (previous?.runs ?? 0) + 1,
      bucket: BUCKET,
      changes: [...merged.values()],
    },
    null,
    2,
  ) + "\n",
  "utf8",
);
console.log(`\nbackup written → ${path.relative(process.cwd(), BACKUP_PATH)} (${merged.size} cell(s) on record)`);

let updated = 0;
let failed = 0;

for (const c of changes) {
  // Guard on the old value as well as the key: if something else changed this row
  // since we read it, skip rather than overwrite a newer value.
  const { data, error } = await supabase
    .from(c.table)
    .update({ [c.column]: c.newValue })
    .eq(c.pk, c.id)
    .eq(c.column, c.oldValue)
    .select(c.pk);

  if (error) {
    failed++;
    console.warn(`x ${c.table}#${c.id}.${c.column} — ${error.message}`);
  } else if (!data?.length) {
    failed++;
    console.warn(`x ${c.table}#${c.id}.${c.column} — row changed since it was read, skipped`);
  } else {
    updated++;
  }
}

console.log(`\n${"=".repeat(64)}`);
console.log(`${updated} reference(s) updated, ${failed} failed`);

if (failed) {
  console.error(
    "\nSome updates failed. Roll back with:\n" +
      "  node scripts/update-image-references.mjs --rollback\n" +
      "Do NOT run the delete script until every reference is updated.",
  );
  process.exitCode = 1;
} else {
  console.log(
    "\nThe site now serves the .webp copies; the originals are still in the bucket.\n" +
      "Check the site, then: node scripts/delete-original-images.mjs",
  );
}
