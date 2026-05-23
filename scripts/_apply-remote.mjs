// One-off: apply local migrations to the linked Supabase project via the
// Management API (uses SUPABASE_ACCESS_TOKEN, no DB password required), then
// record them in supabase_migrations.schema_migrations so the CLI stays in sync.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/_apply-remote.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
  return text;
}

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

async function record(version, name) {
  await runSql(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, name text, statements text[]
    );
    insert into supabase_migrations.schema_migrations (version, name, statements)
    values ('${version}', '${name}', '{}')
    on conflict (version) do nothing;
  `);
}

for (const file of files) {
  const version = file.split('_')[0];
  const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
  const sql = readFileSync(join(dir, file), 'utf8');
  process.stdout.write(`Applying ${file} ... `);
  try {
    await runSql(sql);
    await record(version, name);
    console.log('OK');
  } catch (e) {
    if (/already exists/i.test(e.message)) {
      await record(version, name);
      console.log('SKIP (already applied)');
    } else {
      throw e;
    }
  }
}

// One-off reconcile: the deployed Phase 1 predated the price_cents nullability
// change. dropping NOT NULL is a no-op if already nullable.
process.stdout.write('Reconciling price_cents nullability ... ');
await runSql(`alter table public.menu_items alter column price_cents drop not null;`);
console.log('OK');

console.log('\nMigrations reconciled. Verifying...');
const tables = await runSql(`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name;
`);
console.log(tables);
