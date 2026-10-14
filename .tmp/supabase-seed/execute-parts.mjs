import fs from 'fs';
import path from 'path';

const qdir = path.join(process.cwd(), '.tmp/supabase-seed/queries');
const kind = process.argv[2]; // prod|img
const batch = parseInt(process.argv[3] || '0', 10);
const batchSize = 4;
const files = fs
  .readdirSync(qdir)
  .filter((f) => f.startsWith(`ALL-${kind}-part-`) && f.endsWith('.query.sql'))
  .sort();
const slice = files.slice(batch * batchSize, (batch + 1) * batchSize);
if (!slice.length) {
  console.log(JSON.stringify({ done: true }));
  process.exit(0);
}
const payload = slice.map((f) => ({
  file: f,
  query: fs.readFileSync(path.join(qdir, f), 'utf8'),
}));
console.log(JSON.stringify({ batch, files: slice, payload }));
