/**
 * Prints one query file per line as JSON: {"file":"prod-00000.json","query":"..."}
 * Agent consumes stdout and calls user-supabase execute_sql.
 */
import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), '.tmp/supabase-seed');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'json-chunks/manifest.json'), 'utf8'));
const qdir = path.join(root, 'queries');
const groups = [
  ['cat', manifest.catFiles],
  ['prod', manifest.productFiles],
  ['img', manifest.imageFiles],
];
const only = process.argv[2]; // cat|prod|img|all
const start = parseInt(process.argv[3] || '0', 10);
const count = parseInt(process.argv[4] || '9999', 10);

const list = [];
for (const [g, files] of groups) {
  if (only && only !== 'all' && only !== g) continue;
  for (const f of files) list.push(f);
}
const slice = list.slice(start, start + count);
for (const f of slice) {
  const base = f.replace('.json', '');
  const query = fs.readFileSync(path.join(qdir, `${base}.query.sql`), 'utf8');
  process.stdout.write(JSON.stringify({ file: f, query }) + '\n');
}
