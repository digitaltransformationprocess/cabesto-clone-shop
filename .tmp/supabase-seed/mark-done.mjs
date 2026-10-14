import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(root, 'import-state.json');
const files = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
for (const f of files) {
  if (!state.done.includes(f)) state.done.push(f);
}
fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
console.log(JSON.stringify({ added: files.length, doneCount: state.done.length }));
