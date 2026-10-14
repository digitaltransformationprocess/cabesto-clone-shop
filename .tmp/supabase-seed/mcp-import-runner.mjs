import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), '.tmp/supabase-seed');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'json-chunks/manifest.json'), 'utf8'));
const qdir = path.join(root, 'queries');
const statePath = path.join(root, 'import-state.json');

const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : { done: [], failed: [] };

const allFiles = [...manifest.productFiles, ...manifest.imageFiles];
const pending = allFiles.filter((f) => !state.done.includes(f) && !state.failed.some((x) => x.file === f));

const batchSize = parseInt(process.argv[2] || '4', 10);
const batch = pending.slice(0, batchSize);

if (batch.length === 0) {
  console.log(JSON.stringify({ status: 'complete', state }));
  process.exit(0);
}

const payload = batch.map((f) => {
  const base = f.replace('.json', '');
  return {
    file: f,
    query: fs.readFileSync(path.join(qdir, `${base}.query.sql`), 'utf8'),
  };
});

console.log(JSON.stringify({ status: 'batch', remaining: pending.length - batch.length, payload }));
