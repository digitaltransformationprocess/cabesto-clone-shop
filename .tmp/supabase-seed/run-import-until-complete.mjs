/**
 * Runs full prod/img import via Supabase MCP HTTP (same endpoint as Cursor mcp.json).
 * Requires MCP auth: set SUPABASE_MCP_ACCESS_TOKEN or run `npx @supabase/mcp-server-supabase` login flow once.
 *
 * Usage: node run-import-until-complete.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const seed = path.dirname(fileURLToPath(import.meta.url));
const shop = path.resolve(seed, '../..');
const batchDir = path.join(seed, 'current-batch');
const MCP_URL =
  process.env.SUPABASE_MCP_URL ||
  'https://mcp.supabase.com/mcp?project_ref=dlxismvcvhbbhcaovzrz&features=database';

async function mcpExecuteSql(query, token) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'execute_sql', arguments: { query } },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MCP ${res.status}: ${text.slice(0, 800)}`);
  return text;
}

function stageBatch() {
  const raw = execSync('node .tmp/supabase-seed/mcp-import-runner.mjs 4', {
    cwd: shop,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const j = JSON.parse(raw.trim());
  if (j.status === 'complete') return { complete: true };
  fs.mkdirSync(batchDir, { recursive: true });
  j.payload.forEach((p, i) => {
    fs.writeFileSync(path.join(batchDir, `${i}.sql`), p.query, 'utf8');
    fs.writeFileSync(path.join(batchDir, `${i}.file`), p.file, 'utf8');
  });
  return { complete: false, remaining: j.remaining, files: j.payload.map((p) => p.file) };
}

function queriesForIndex(i) {
  const sql = fs.readFileSync(path.join(batchDir, `${i}.sql`), 'utf8');
  const DIRECT_MAX = 120_000;
  if (sql.length <= DIRECT_MAX) return [sql];
  const m = sql.match(/select public\.import_products\(\$json\$(.*)\$json\$::jsonb\)/s);
  if (!m) throw new Error(`parse fail index ${i}`);
  const products = JSON.parse(m[1]);
  const out = [];
  const chunkSize = 10;
  for (let c = 0; c < products.length; c += chunkSize) {
    const slice = products.slice(c, c + chunkSize);
    out.push(
      `select public.import_products($json$${JSON.stringify(slice)}$json$::jsonb) as n;`,
    );
  }
  return out;
}

async function main() {
  const token = process.env.SUPABASE_MCP_ACCESS_TOKEN;
  if (!token) {
    console.error('Set SUPABASE_MCP_ACCESS_TOKEN (Supabase MCP OAuth access token).');
    process.exit(1);
  }
  let batches = 0;
  while (true) {
    const staged = stageBatch();
    if (staged.complete) {
      console.log(JSON.stringify({ status: 'complete', batches }));
      break;
    }
    batches++;
    const files = staged.files;
    for (let i = 0; i < files.length; i++) {
      const qs = queriesForIndex(i);
      for (const q of qs) {
        let lastErr;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await mcpExecuteSql(q, token);
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (lastErr) throw lastErr;
      }
    }
    execSync(`node .tmp/supabase-seed/mark-done.mjs ${files.map((f) => JSON.stringify(f)).join(' ')}`, {
      cwd: shop,
      encoding: 'utf8',
    });
    console.log(JSON.stringify({ batch: batches, marked: files, remaining: staged.remaining }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
