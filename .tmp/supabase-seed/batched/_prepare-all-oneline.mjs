import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store =
  process.argv[2] ||
  'C:/Users/bilal/AppData/Local/Cursor/AgentStores/cursor_agent_stores/e35e9cd6-9ef5-4748-ba76-01c9548d6331/files';

const batches = [
  '02-products-00.sql',
  '02-products-05.sql',
  '02-products-10.sql',
  '02-products-15.sql',
  '03-images-00.sql',
  '03-images-06.sql',
  '03-images-12.sql',
  '03-images-18.sql',
  '03-images-24.sql',
  '03-images-30.sql',
  '03-images-36.sql',
  '03-images-42.sql',
];

for (const b of batches) {
  const out = execSync(`node "${path.join(__dirname, '_prepare-oneline-invoke.mjs')}" "${b}" "${store}"`, {
    encoding: 'utf8',
  });
  console.log(out.trim());
}
