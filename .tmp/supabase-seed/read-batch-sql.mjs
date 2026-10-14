import fs from 'fs';
const i = process.argv[2];
const q = fs.readFileSync(`.tmp/supabase-seed/current-batch/${i}.sql`, 'utf8');
process.stdout.write(q);
