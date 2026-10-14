/**
 * Upload data/images/** → Supabase Storage `product-media`
 * Uses long-timeout fetch (this network is slow to Storage).
 *
 *   node scripts/upload-product-media.mjs
 *   node scripts/upload-product-media.mjs --covers
 */
import fs from "node:fs";
import path from "node:path";
import { Agent, fetch as undiciFetch } from "undici";

const ROOT = path.resolve("data/images");
const BUCKET = "product-media";
const STATE_PATH = path.resolve(".tmp/storage-upload-state.json");
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://dlxismvcvhbbhcaovzrz.supabase.co").replace(/\/$/, "");
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRseGlzbXZjdmhiYmhjYW92enJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDMyODksImV4cCI6MjEwNzQ3OTI4OX0.QntfoTjA2OysI3rJLWM1a1CvLyY0NcPONw4gIM8uH6Y";

const coversOnly = process.argv.includes("--covers");
const CONCURRENCY = Number(process.env.UPLOAD_CONCURRENCY || 4);
const MAX_RETRIES = Number(process.env.UPLOAD_RETRIES || 5);

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const agent = new Agent({
  connect: { timeout: 60_000 },
  headersTimeout: 300_000,
  bodyTimeout: 300_000,
  keepAliveTimeout: 60_000,
});

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (MIME[path.extname(ent.name).toLowerCase()]) acc.push(full);
  }
  return acc;
}

function coverFiles() {
  const catalog = JSON.parse(fs.readFileSync("src/lib/catalog.json", "utf8"));
  const out = [];
  const seen = new Set();
  for (const p of catalog.products) {
    const cover = p.cover || p.images?.[0];
    if (!cover?.startsWith("/media/")) continue;
    const rel = cover.slice("/media/".length);
    if (seen.has(rel)) continue;
    seen.add(rel);
    const full = path.join(ROOT, ...rel.split("/"));
    if (fs.existsSync(full)) out.push(full);
  }
  return out;
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return { done: {}, failed: {} };
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state));
}

async function uploadKey(key, full) {
  const ext = path.extname(full).toLowerCase();
  const body = fs.readFileSync(full);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await undiciFetch(url, {
        method: "POST",
        dispatcher: agent,
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          "Content-Type": MIME[ext] || "application/octet-stream",
          "x-upsert": "true",
          "cache-control": "31536000",
        },
        body,
      });
      if (res.status === 200 || res.status === 201) return;
      // already exists
      if (res.status === 409) return;
      const text = await res.text();
      // upsert sometimes needs PUT
      if (res.status === 400 && text.includes("already exists")) {
        const put = await undiciFetch(url, {
          method: "PUT",
          dispatcher: agent,
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            "Content-Type": MIME[ext] || "application/octet-stream",
            "x-upsert": "true",
            "cache-control": "31536000",
          },
          body,
        });
        if (put.status === 200 || put.status === 201) return;
        throw new Error(`PUT ${put.status}: ${(await put.text()).slice(0, 200)}`);
      }
      throw new Error(`${res.status}: ${text.slice(0, 200)}`);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw lastErr;
}

const files = coversOnly ? coverFiles() : walk(ROOT);
const state = loadState();
const pending = files.filter((f) => {
  const key = path.relative(ROOT, f).split(path.sep).join("/");
  return !state.done[key];
});

console.log(JSON.stringify({ mode: coversOnly ? "covers" : "all", total: files.length, pending: pending.length, concurrency: CONCURRENCY }));

let ok = 0;
let fail = 0;
let i = 0;

async function worker() {
  while (i < pending.length) {
    const idx = i++;
    const full = pending[idx];
    const key = path.relative(ROOT, full).split(path.sep).join("/");
    try {
      await uploadKey(key, full);
      state.done[key] = true;
      delete state.failed[key];
      ok++;
    } catch (e) {
      state.failed[key] = String(e.message || e);
      fail++;
      console.error(`FAIL ${key}:`, e.message || e);
    }
    if ((ok + fail) % 20 === 0 || ok + fail === pending.length) {
      saveState(state);
      console.log(`Progress ${ok + fail}/${pending.length} (ok=${ok}, fail=${fail}) doneTotal=${Object.keys(state.done).length}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
saveState(state);
console.log(JSON.stringify({ ok, fail, doneTotal: Object.keys(state.done).length, failedTotal: Object.keys(state.failed).length }, null, 2));
