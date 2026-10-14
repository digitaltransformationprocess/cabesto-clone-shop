import fs from 'fs';
const i = process.argv[2];
const q = JSON.parse(fs.readFileSync(`.tmp/supabase-seed/current-batch/mcp-args-${i}.json`, 'utf8')).query;
console.log(JSON.stringify({ i, skus: (q.match(/"sku"/g) || []).length, len: q.length }));
