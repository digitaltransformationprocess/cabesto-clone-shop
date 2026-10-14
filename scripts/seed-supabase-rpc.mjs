/**
 * Finishes catalog seed via security-definer RPCs (created via Supabase MCP).
 * Reads pending chunks from import-state.json and posts to /rest/v1/rpc/*.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".tmp/supabase-seed");
const CHUNKS = path.join(ROOT, "json-chunks");
const STATE_PATH = path.join(ROOT, "import-state.json");
const PROJECT_URL = process.env.SUPABASE_URL || "https://dlxismvcvhbbhcaovzrz.supabase.co";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRseGlzbXZjdmhiYmhjYW92enJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDMyODksImV4cCI6MjEwNzQ3OTI4OX0.QntfoTjA2OysI3rJLWM1a1CvLyY0NcPONw4gIM8uH6Y";

const manifest = JSON.parse(fs.readFileSync(path.join(CHUNKS, "manifest.json"), "utf8"));
const state = fs.existsSync(STATE_PATH)
  ? JSON.parse(fs.readFileSync(STATE_PATH, "utf8"))
  : { done: [], failed: [] };

function saveState() {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function rpcName(file) {
  if (file.startsWith("cat")) return "import_categories";
  if (file.startsWith("prod")) return "import_products";
  if (file.startsWith("img")) return "import_product_images";
  throw new Error(`Unknown chunk type: ${file}`);
}

async function callRpc(fn, payload) {
  const res = await fetch(`${PROJECT_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ payload }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn} ${res.status}: ${text.slice(0, 400)}`);
  return text;
}

const all = [...manifest.catFiles, ...manifest.productFiles, ...manifest.imageFiles];
const pending = all.filter((f) => !state.done.includes(f));

console.log(`Pending: ${pending.length}`);

const concurrency = 4;
let i = 0;
async function worker() {
  while (i < pending.length) {
    const idx = i++;
    const file = pending[idx];
    const fn = rpcName(file);
    const payload = JSON.parse(fs.readFileSync(path.join(CHUNKS, file), "utf8"));
    try {
      const n = await callRpc(fn, payload);
      state.done.push(file);
      saveState();
      console.log(`OK ${file} -> ${n}`);
    } catch (e) {
      state.failed.push({ file, error: String(e.message || e) });
      saveState();
      console.error(`FAIL ${file}:`, e.message || e);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
console.log(
  JSON.stringify(
    {
      done: state.done.length,
      failed: state.failed.length,
      failures: state.failed.slice(0, 10),
    },
    null,
    2,
  ),
);
