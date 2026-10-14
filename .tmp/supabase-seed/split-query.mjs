import fs from 'fs';
import path from 'path';

const max = 90000;
const src = process.argv[2];
const prefix = process.argv[3];
const outDir = path.join(process.cwd(), '.tmp/supabase-seed/queries');
const q = fs.readFileSync(src, 'utf8');
const start = q.indexOf('$json$') + 6;
const end = q.lastIndexOf('$json$');
const fn = q.match(/select public\.(\w+)\(/)[1];
const data = JSON.parse(q.slice(start, end));
const parts = [];
let buf = [];
let len = 0;
const overhead = `select public.${fn}($json$[]$json$::jsonb) as n;`.length;
for (const row of data) {
  const piece = JSON.stringify(row);
  const add = (buf.length ? 1 : 0) + piece.length;
  if (len + add + overhead > max && buf.length) {
    parts.push(buf);
    buf = [];
    len = 0;
  }
  buf.push(row);
  len += add;
}
if (buf.length) parts.push(buf);
parts.forEach((chunk, i) => {
  const query = `select public.${fn}($json$${JSON.stringify(chunk)}$json$::jsonb) as n;`;
  fs.writeFileSync(path.join(outDir, `${prefix}-part-${String(i).padStart(2, '0')}.query.sql`), query);
});
console.log(JSON.stringify({ parts: parts.length, rows: data.length, fn }));
