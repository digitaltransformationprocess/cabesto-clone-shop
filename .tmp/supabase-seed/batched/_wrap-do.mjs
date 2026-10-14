import fs from 'fs';
const sql = fs.readFileSync(process.argv[2], 'utf8');
const b64 = Buffer.from(sql, 'utf8').toString('base64');
const q = `DO $mcp$ BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END $mcp$;`;
if (process.argv[3]) fs.writeFileSync(process.argv[3], q, 'utf8');
else process.stdout.write(q);
console.error('len', q.length);
