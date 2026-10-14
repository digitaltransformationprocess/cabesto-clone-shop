import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve("data/images");
const sb = createClient(
  "https://dlxismvcvhbbhcaovzrz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRseGlzbXZjdmhiYmhjYW92enJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDMyODksImV4cCI6MjEwNzQ3OTI4OX0.QntfoTjA2OysI3rJLWM1a1CvLyY0NcPONw4gIM8uH6Y",
  { auth: { persistSession: false } },
);
const state = JSON.parse(fs.readFileSync(".tmp/storage-upload-state.json", "utf8"));
const catalog = JSON.parse(fs.readFileSync("src/lib/catalog.json", "utf8"));
const pending = [];
for (const p of catalog.products) {
  const cover = p.cover || p.images?.[0];
  if (!cover?.startsWith("/media/")) continue;
  const key = cover.slice(7);
  if (state.done[key]) continue;
  const full = path.join(ROOT, ...key.split("/"));
  if (fs.existsSync(full)) pending.push({ key, full });
}
const batch = pending.slice(0, 12);
console.log("batch", batch.length, "pending covers", pending.length);
const t0 = Date.now();
let ok = 0;
let fail = 0;
await Promise.all(
  batch.map(async ({ key, full }) => {
    const t = Date.now();
    const body = fs.readFileSync(full);
    const ext = path.extname(full).toLowerCase();
    const type = ext === ".png" ? "image/png" : "image/jpeg";
    const { error } = await sb.storage.from("product-media").upload(key, body, {
      contentType: type,
      upsert: true,
    });
    if (error) {
      fail++;
      console.log("FAIL", key, error.message, Date.now() - t);
    } else {
      ok++;
      state.done[key] = true;
      console.log("OK", key, body.length, `${Date.now() - t}ms`);
    }
  }),
);
fs.writeFileSync(".tmp/storage-upload-state.json", JSON.stringify(state));
console.log({ ok, fail, elapsed: Date.now() - t0, done: Object.keys(state.done).length });
