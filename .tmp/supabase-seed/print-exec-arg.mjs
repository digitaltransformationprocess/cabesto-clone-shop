import fs from 'fs';
const i = process.argv[2];
const j = JSON.parse(fs.readFileSync(`.tmp/supabase-seed/exec-payload-${i}.json`, 'utf8'));
process.stdout.write(JSON.stringify({ query: j.query }));
