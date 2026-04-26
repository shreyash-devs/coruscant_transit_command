/**
 * Reads SourceAndDestination.xlsx and writes public/data/routes.json
 * Run: node scripts/generate-routes-json.mjs [path-to-xlsx]
 * Default: public/data/SourceAndDestination.xlsx or first arg
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const outPath = path.join(root, 'public', 'data', 'routes.json');

const fallbackPaths = [
  process.argv[2],
  path.join(root, 'public', 'data', 'SourceAndDestination.xlsx'),
  'c:/Users/prasa/Downloads/SourceAndDestination.xlsx',
].filter(Boolean);

function main() {
  const resolved = fallbackPaths.find((p) => fs.existsSync(p));
  if (!resolved) {
    console.error('Input file not found. Tried:', fallbackPaths);
    process.exit(1);
  }
  console.log('Reading:', resolved);

  const wb = XLSX.readFile(resolved);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  const routes = rows
    .map((row) => {
      const route_id = String(row['Route ID'] ?? row.route_id ?? '').trim();
      const source = String(row['Source Description'] ?? row.source ?? '').trim();
      const destination = String(row['Destination Description'] ?? row.destination ?? '').trim();
      return { route_id, source, destination };
    })
    .filter((r) => r.route_id && r.source && r.destination);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(routes, null, 2), 'utf8');
  console.log(`Wrote ${routes.length} routes to ${outPath}`);
}

main();
