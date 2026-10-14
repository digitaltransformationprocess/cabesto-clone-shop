const fs = require('fs');
const path = require('path');
const dir = __dirname;
const name = process.argv[2];
if (!name) {
  console.error('usage: node _load-query.cjs <file.sql>');
  process.exit(1);
}
const query = fs.readFileSync(path.join(dir, name), 'utf8');
process.stdout.write(JSON.stringify({ query }));
