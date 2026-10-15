/**
 * Push enriched descriptions from data/products/*.json → Supabase products.description.
 *
 *   node scripts/sync-product-descriptions.mjs
 *   node scripts/sync-product-descriptions.mjs --dry-run
 *   node scripts/sync-product-descriptions.mjs --limit=50
 *   node scripts/sync-product-descriptions.mjs --only-enriched
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env
 * Then: npm run rag:index
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const PRODUCTS_DIR = path.join(ROOT, "data", "products");
const SEO_RE = /^Achetez .+ chez Cabesto/i;
const BATCH = 40;

function readDotEnv() {
  const out = {};
  try {
    const file = path.resolve(ROOT, ".env");
    if (!fs.existsSync(file)) return out;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[t.slice(0, eq).trim()] = val;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function parseArgs(argv) {
  const out = { dryRun: false, limit: 0, onlyEnriched: false };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--only-enriched") out.onlyEnriched = true;
    else if (a.startsWith("--limit=")) out.limit = Number(a.slice(8)) || 0;
  }
  return out;
}

function collectUpdates(opts) {
  const files = fs.readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith(".json"));
  const rows = [];
  for (const file of files) {
    const abs = path.join(PRODUCTS_DIR, file);
    let p;
    try {
      p = JSON.parse(fs.readFileSync(abs, "utf8"));
    } catch {
      continue;
    }
    const desc = (p.description || "").trim();
    if (!desc || !p.sku) continue;
    if (opts.onlyEnriched && p.descriptionSource !== "fiche") continue;
    if (SEO_RE.test(desc)) continue;
    rows.push({ sku: p.sku, description: desc });
  }
  if (opts.limit > 0) return rows.slice(0, opts.limit);
  return rows;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const env = { ...readDotEnv(), ...process.env };
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required in .env");
  }

  const updates = collectUpdates(opts);
  console.log(`Rows to sync: ${updates.length}${opts.dryRun ? " (dry-run)" : ""}`);
  if (!updates.length) return;
  if (opts.dryRun) {
    console.log("Sample:", updates.slice(0, 3).map((u) => `${u.sku} (${u.description.length}c)`));
    return;
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  let ok = 0;
  let miss = 0;
  let err = 0;

  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    for (const row of chunk) {
      const { data, error } = await sb
        .from("products")
        .update({ description: row.description })
        .eq("sku", row.sku)
        .select("id");
      if (error) {
        err++;
        console.error(`ERR ${row.sku}: ${error.message}`);
        continue;
      }
      if (!data?.length) {
        miss++;
        continue;
      }
      ok++;
    }
    process.stdout.write(`\rSynced ${Math.min(i + chunk.length, updates.length)}/${updates.length}`);
  }
  console.log(`\nDone. updated=${ok} missing=${miss} errors=${err}`);
  if (ok > 0) console.log("Next: npm run rag:index");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
