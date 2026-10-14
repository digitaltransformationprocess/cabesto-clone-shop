/**
 * Prints next SQL file paths for agent execute_sql batch (4 max).
 * Usage: node mcp-exec-sql-file.mjs path1.sql path2.sql ...
 */
import fs from 'fs';

for (const p of process.argv.slice(2)) {
  const query = fs.readFileSync(p, 'utf8');
  if (!query.trim()) {
    console.error('empty', p);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify({ path: p, bytes: query.length }) + '\n');
}
