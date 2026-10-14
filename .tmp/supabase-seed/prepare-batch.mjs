import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const chunksDir = path.join(root, "json-chunks");
const queriesDir = path.join(root, "queries");
const statePath = path.join(root, "import-state.json");

const kind = process.argv[2] || "prod";
const batchSize = Number(process.argv[3] || 4);

const manifest = JSON.parse(
  fs.readFileSync(path.join(chunksDir, "manifest.json"), "utf8")
);

const lists = {
  prod: manifest.productFiles.filter((f) => f !== "prod-00000.json"),
  img: manifest.imageFiles,
};

const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : { prod: 0, img: 0, failed: [] };

const files = lists[kind] || [];
const start = state[kind] || 0;
const slice = files.slice(start, start + batchSize);

const batch = slice.map((file) => {
  const base = file.replace(/\.json$/, "");
  const queryPath = path.join(queriesDir, `${base}.query.sql`);
  const jsonPath = path.join(chunksDir, file);
  let query;
  if (fs.existsSync(queryPath)) {
    query = fs.readFileSync(queryPath, "utf8").trim();
  } else {
    const json = fs.readFileSync(jsonPath, "utf8");
    if (kind === "prod") {
      query = `select public.import_products($json$${json}$json$::jsonb) as n;`;
    } else {
      query = `select public.import_product_images($json$${json}$json$::jsonb) as n;`;
    }
  }
  return { file, query };
});

const outPath = path.join(root, "batch-pending.json");
fs.writeFileSync(
  outPath,
  JSON.stringify({ kind, start, batch, done: start + slice.length >= files.length })
);

console.log(JSON.stringify({ kind, start, count: batch.length, files: slice, outPath }));
