// One-off: download menu photos from their current (ImageKit) URLs and re-host
// them in the Supabase `menu-images` bucket, then point image_url at Supabase.
// Idempotent: anything already on our Supabase project is skipped.
//   SUPABASE_SECRET_KEY=sb_secret_... node scripts/_migrate-images.mjs
import { createClient } from "@supabase/supabase-js";

const URL = "https://fbzwicfvhrtyfqjounvo.supabase.co";
const HOST = "fbzwicfvhrtyfqjounvo.supabase.co";
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!KEY) {
  console.error("Missing SUPABASE_SECRET_KEY");
  process.exit(1);
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const { data: items, error } = await supabase
  .from("menu_items")
  .select("id, name, image_url")
  .not("image_url", "is", null);
if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

const todo = items.filter((i) => i.image_url && !i.image_url.includes(HOST));
console.log(`${items.length} items with images; ${todo.length} to migrate.\n`);

let migrated = 0,
  skipped = 0,
  failed = 0;

for (const it of todo) {
  try {
    const res = await fetch(it.image_url);
    if (!res.ok) {
      console.warn(`✗ ${it.name} — download ${res.status}`);
      failed++;
      continue;
    }
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());

    // pick extension from the URL path, fall back to content-type
    let ext = "";
    try {
      ext = (new URL(it.image_url).pathname.split(".").pop() || "").toLowerCase();
    } catch {
      /* ignore */
    }
    if (!ext || ext.length > 5) ext = (ct.split("/")[1] || "jpg").split(";")[0];
    ext = ext.replace("jpeg", "jpg");

    const path = `items/${it.id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("menu-images")
      .upload(path, buf, { contentType: ct, upsert: true });
    if (upErr) {
      console.warn(`✗ ${it.name} — upload: ${upErr.message}`);
      failed++;
      continue;
    }
    const { data: pub } = supabase.storage.from("menu-images").getPublicUrl(path);
    const { error: updErr } = await supabase
      .from("menu_items")
      .update({ image_url: pub.publicUrl })
      .eq("id", it.id);
    if (updErr) {
      console.warn(`✗ ${it.name} — db update: ${updErr.message}`);
      failed++;
      continue;
    }
    console.log(`✓ ${it.name} (${ext})`);
    migrated++;
  } catch (e) {
    console.warn(`✗ ${it.name} — ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

console.log(`\nDone. Migrated ${migrated}, failed ${failed}, already-on-supabase ${items.length - todo.length}.`);
