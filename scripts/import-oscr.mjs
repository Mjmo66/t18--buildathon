// Load the Scottish Charity Register (OSCR) into charity_registry. Idempotent: run it whenever
// OSCR publishes a new export (daily: https://www.oscr.org.uk → Charity Register Download).
//   node --env-file=.env.seed scripts/import-oscr.mjs CharityExport-15-Nov-2026.zip [--dry-run]
// Accepts the .zip as downloaded (needs `unzip`) or the .csv inside it. Charities that left the
// register are removed; demo rows (source 'demo', from seed.sql) are left alone.
// Only public register fields are stored; trustee addresses are not.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const ACTIVITIES_MAX = 1000; // matches charities.description, so it can prefill that field
const BATCH = 1000;

/** RFC 4180 CSV → array of string arrays (quoted fields may hold commas, quotes and newlines). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (s) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
};
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** OSCR export rows → charity_registry rows. Throws when the columns are not the expected ones. */
export function toRegistryRows(table, importedAt) {
  const [header, ...body] = table;
  const col = Object.fromEntries(header.map((h, i) => [h.replace(/^﻿/, '').trim(), i]));
  for (const name of ['Charity Number', 'Charity Name', 'Charity Status', 'Known As', 'Website',
    'What the charity is set up to do and how it does this']) {
    if (!(name in col)) throw new Error(`Column "${name}" missing: is this an OSCR register export?`);
  }
  const get = (r, name) => r[col[name]];
  const out = [];
  for (const r of body) {
    const number = (get(r, 'Charity Number') ?? '').toUpperCase().replace(/\s+/g, '');
    const name = clean(get(r, 'Charity Name'));
    if (!/^SC\d{6}$/.test(number) || !name) continue;
    out.push({
      charity_number: number,
      org_name: name,
      register: 'OSCR',
      known_as: clean(get(r, 'Known As')),
      status: clean(get(r, 'Charity Status')),
      website: clean(get(r, 'Website')),
      activities: clip(clean(get(r, 'What the charity is set up to do and how it does this')), ACTIVITIES_MAX),
      source: 'oscr',
      imported_at: importedAt,
    });
  }
  return out;
}

function readExport(path) {
  if (/\.zip$/i.test(path)) {
    const names = execFileSync('unzip', ['-Z1', path], { encoding: 'utf8' }).split('\n').filter((n) => /\.csv$/i.test(n));
    if (names.length !== 1) throw new Error(`Expected one .csv in ${path}, found ${names.length}.`);
    return execFileSync('unzip', ['-p', path, names[0]], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  }
  return readFileSync(path, 'utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) { console.error('Usage: node --env-file=.env.seed scripts/import-oscr.mjs <export.zip|.csv> [--dry-run]'); process.exit(1); }

  const importedAt = new Date().toISOString();
  const rows = toRegistryRows(parseCsv(readExport(file)), importedAt);
  const byStatus = rows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});
  console.log(`${rows.length} charities in the export`, byStatus);
  if (rows.length < 1000) throw new Error('Fewer than 1000 charities: refusing to import (and to delete the rest).');
  if (dryRun) { console.log('Dry run: nothing written.'); return; }

  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.seed).'); process.exit(1); }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db.from('charity_registry').upsert(rows.slice(i, i + BATCH), { onConflict: 'charity_number' });
    if (error) throw new Error(`Upsert failed at row ${i}: ${error.message}`);
    process.stdout.write(`\r${Math.min(i + BATCH, rows.length)}/${rows.length} upserted`);
  }
  process.stdout.write('\n');

  // Charities no longer on the register (not in this export).
  const { error: delErr, count } = await db.from('charity_registry')
    .delete({ count: 'exact' }).eq('source', 'oscr').lt('imported_at', importedAt);
  if (delErr) throw new Error(`Removing old entries failed: ${delErr.message}`);
  console.log(`${count ?? 0} charities removed from the register since the last import.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
