// One-off: dump every sheet of the Momma Mia menu workbook to JSON for inspection.
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? 'docs/MOMMA MIA SHEET.xlsx';
const buf = readFileSync(path);
const wb = XLSX.read(buf, { type: 'buffer' });
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`\n===== SHEET: ${name} (${rows.length} rows) =====`);
  console.log(JSON.stringify(rows, null, 2));
}
