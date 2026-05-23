// One-off: seed categories + menu_items from the Momma Mia Excel workbook into
// the linked Supabase project via the Management API.
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/_seed-menu.mjs "<path-to-xlsx>"
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

const REF = process.env.SUPABASE_PROJECT_REF || 'fbzwicfvhrtyfqjounvo';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('Missing SUPABASE_ACCESS_TOKEN'); process.exit(1); }
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function runSql(query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const esc = (v) => (v === null || v === undefined || v === '') ? 'null' : `'${String(v).trim().replace(/'/g, "''")}'`;
const clean = (v) => (v === null || v === undefined) ? null : String(v).trim() || null;

// ---- read workbook ---------------------------------------------------------
const path = process.argv[2] ?? 'docs/MOMMA MIA SHEET.xlsx';
const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
const rows = XLSX.utils
  .sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
  .filter(r => clean(r.Name));   // skip blank spacer rows in the sheet

// ---- categories: pretty names + display order ------------------------------
const CATS = {
  'check-a-lunch': { name: 'Check-a-Lunch', sort: 1 },
  'cafe-menu':     { name: 'Café Menu',     sort: 2 },
  'party-tray':    { name: 'Party Trays',   sort: 3 },
  'fun-boxes':     { name: 'Fun Boxes',     sort: 4 },
  'add-on':        { name: 'Add-ons',       sort: 5 },
};
const cateringSlugs = new Set(['party-tray', 'fun-boxes']);
const slugs = [...new Set(rows.map(r => clean(r.Category)).filter(Boolean))];
for (const s of slugs) if (!CATS[s]) CATS[s] = { name: s, sort: 99 };

await runSql(
  `insert into public.categories (slug, name, sort_order) values ` +
  slugs.map(s => `(${esc(s)}, ${esc(CATS[s].name)}, ${CATS[s].sort})`).join(', ') +
  ` on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;`
);
console.log(`Upserted ${slugs.length} categories: ${slugs.join(', ')}`);

// ---- map slug -> id --------------------------------------------------------
const catRows = await runSql(`select id, slug from public.categories;`);
const catId = Object.fromEntries(catRows.map(c => [c.slug, c.id]));

// ---- build menu_items insert (replace whole catalog from the sheet) --------
const values = rows.map((r, i) => {
  const slug = clean(r.Category);
  const price = r.Price === null || r.Price === undefined || r.Price === '' ? 'null' : Math.round(Number(r.Price) * 100);
  const type = clean(r.Type);
  return `(${catId[slug] ?? 'null'}, ${esc(r.Name)}, ${esc(r.Description)}, ${esc(r.Image)}, ` +
         `${price}, ${esc(type)}, true, ${cateringSlugs.has(slug)}, ${i})`;
}).join(',\n');

await runSql(
  `delete from public.menu_items;\n` +
  `insert into public.menu_items ` +
  `(category_id, name, description, image_url, price_cents, item_type, is_available, is_catering, sort_order) values\n` +
  values + `;`
);

const [{ count }] = await runSql(`select count(*)::int as count from public.menu_items;`);
console.log(`Seeded ${count} menu items.`);
const summary = await runSql(
  `select c.slug, count(*)::int as items from public.menu_items m ` +
  `join public.categories c on c.id = m.category_id group by c.slug order by c.slug;`
);
console.log(JSON.stringify(summary));
