import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(root, "import-state.json");
const batchPath = path.join(root, "batch-pending.json");

const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"));
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : { prod: 0, img: 0, failed: [] };

state[batch.kind] = (state[batch.kind] || 0) + batch.batch.length;
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
console.log(JSON.stringify(state));
