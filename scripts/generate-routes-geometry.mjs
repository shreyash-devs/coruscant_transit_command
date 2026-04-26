/**
 * Build cached road geometries for routes using OSRM.
 * Input:
 *   - public/data/routes.json
 *   - public/data/stops.xlsx
 * Output:
 *   - public/data/routes_with_geometry.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const routesPath = path.join(root, 'public', 'data', 'routes.json');
const stopsPath = path.join(root, 'public', 'data', 'stops.xlsx');
const outPath = path.join(root, 'public', 'data', 'routes_with_geometry.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeStopName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isValidCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function parseStopsWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath);
  const allStops = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    for (const row of rows) {
      const stopName =
        String(row.stop_name || row['Stop Name'] || row['stop name'] || row.name || row['Bus Stop Name'] || '').trim();
      const lat = Number(String(row.latitude || row.Latitude || row.lat || '').trim());
      const lng = Number(String(row.longitude || row.Longitude || row.lng || row.lon || row.long || '').trim());
      if (!stopName || !isValidCoordinate(lat, lng)) continue;
      allStops.push({ stop_name: stopName, latitude: lat, longitude: lng });
    }
  }

  return allStops;
}

async function fetchOsrmRoadGeometry(source, destination) {
  const [sLat, sLng] = source;
  const [dLat, dLng] = destination;
  const url = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${dLng},${dLat}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = await response.json();
    const coords = payload?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    // OSRM returns [lng, lat] -> store [lat, lng] for Leaflet
    return coords.map(([lng, lat]) => [lat, lng]);
  } catch {
    return null;
  }
}

async function main() {
  if (!fs.existsSync(routesPath)) {
    console.error('Missing routes file:', routesPath);
    process.exit(1);
  }
  if (!fs.existsSync(stopsPath)) {
    console.error('Missing stops file:', stopsPath);
    process.exit(1);
  }

  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
  const stops = parseStopsWorkbook(stopsPath);
  const stopLookup = new Map(stops.map((s) => [normalizeStopName(s.stop_name), s]));

  const results = [];
  let skipped = 0;

  for (let i = 0; i < routes.length; i += 1) {
    const route = routes[i];
    const sourceStop = stopLookup.get(normalizeStopName(route.source));
    const destinationStop = stopLookup.get(normalizeStopName(route.destination));

    if (!sourceStop || !destinationStop) {
      skipped += 1;
      console.warn(`[RoutesGeometry] Skip ${route.route_id}: stop not found`, {
        source: route.source,
        destination: route.destination,
      });
      continue;
    }

    const sourceCoords = [sourceStop.latitude, sourceStop.longitude];
    const destinationCoords = [destinationStop.latitude, destinationStop.longitude];
    let geometry = await fetchOsrmRoadGeometry(sourceCoords, destinationCoords);
    let usedFallback = false;

    if (!geometry) {
      geometry = [sourceCoords, destinationCoords];
      usedFallback = true;
      console.warn(`[RoutesGeometry] OSRM failed for ${route.route_id}, using fallback straight line.`);
    }

    results.push({
      route_id: route.route_id,
      source: route.source,
      destination: route.destination,
      source_coords: sourceCoords,
      destination_coords: destinationCoords,
      geometry,
      usedFallback,
    });

    if (i % 25 === 0) {
      console.log(`[RoutesGeometry] Processed ${i + 1}/${routes.length}`);
      // Friendly throttle for public OSRM service
      await sleep(120);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Wrote ${results.length} geometries to ${outPath}`);
  console.log(`Skipped (missing stop): ${skipped}`);
}

main();
