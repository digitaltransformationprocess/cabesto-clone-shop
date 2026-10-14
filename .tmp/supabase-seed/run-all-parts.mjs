import fs from 'fs';
import path from 'path';

const qdir = path.join(process.cwd(), '.tmp/supabase-seed/queries');
const logPath = path.join(process.cwd(), '.tmp/supabase-seed/import-log.jsonl');

const files = fs
  .readdirSync(qdir)
  .filter((f) => /^ALL-(prod|img)-part-\d+\.query\.sql$/.test(f))
  .sort((a, b) => {
    const ka = a.includes('-prod-') ? 0 : 1;
    const kb = b.includes('-prod-') ? 0 : 1;
    if (ka !== kb) return ka - kb;
    return a.localeCompare(b);
  });

const idx = parseInt(process.argv[2] || '0', 10);
const file = files[idx];
if (!file) {
  console.log(JSON.stringify({ done: true, total: files.length }));
  process.exit(0);
}
const query = fs.readFileSync(path.join(qdir, file), 'utf8');
console.log(JSON.stringify({ idx, file, total: files.length, queryLen: query.length, query }));
