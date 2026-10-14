import fs from 'fs';
const i = process.argv[2];
const p = `.tmp/supabase-seed/current-batch/args-${i}.json`;
const { query } = JSON.parse(fs.readFileSync(p, 'utf8'));
process.stdout.write(query);
