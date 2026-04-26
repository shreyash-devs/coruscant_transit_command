import * as XLSX from 'xlsx';

export interface StopPoint {
  stop_name: string;
  latitude: number;
  longitude: number;
}

function isValidCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function toCanonicalHeader(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function pickColumn(row: Record<string, unknown>, candidates: string[]) {
  const wanted = candidates.map((value) => toCanonicalHeader(value));
  for (const [key, value] of Object.entries(row)) {
    if (wanted.includes(toCanonicalHeader(key))) return String(value ?? '').trim();
  }
  return '';
}

export function parseStopsWorkbook(buffer: ArrayBuffer): StopPoint[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const validStops: StopPoint[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });

    rows.forEach((row, index) => {
      const stop_name = pickColumn(row, ['stop_name', 'stop name', 'name', 'Bus Stop Name']);
      const latitudeRaw = pickColumn(row, ['latitude', 'lat']);
      const longitudeRaw = pickColumn(row, ['longitude', 'lng', 'lon', 'long']);
      const latitude = Number(latitudeRaw);
      const longitude = Number(longitudeRaw);

      if (!stop_name || !isValidCoordinate(latitude, longitude)) {
        console.warn(`[StopsMap] Skipping invalid row in sheet "${sheetName}" at index ${index + 1}`, {
          stop_name,
          latitude: latitudeRaw,
          longitude: longitudeRaw,
        });
        return;
      }

      validStops.push({ stop_name, latitude, longitude });
    });
  });

  console.info(`[StopsMap] Parsed valid stops: ${validStops.length}`);
  return validStops;
}
