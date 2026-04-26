import type { StopPoint } from '@/lib/stopsMap';

/** Leaflet-style [lat, lng] */
export type LatLngTuple = [number, number];

const M_PER_DEG_LAT = 110_540;
function mPerDegLon(lat: number) {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

/** Approximate planar meters from lat/lng (good for short distances / city scale). */
function toLocalMeters(lat: number, lng: number, originLat: number, originLng: number) {
  return {
    x: (lng - originLng) * mPerDegLon(originLat),
    y: (lat - originLat) * M_PER_DEG_LAT,
  };
}

function pointSegmentDistanceMeters(
  lat: number,
  lng: number,
  a: LatLngTuple,
  b: LatLngTuple,
  originLat: number,
  originLng: number
) {
  const p = toLocalMeters(lat, lng, originLat, originLng);
  const pa = toLocalMeters(a[0], a[1], originLat, originLng);
  const pb = toLocalMeters(b[0], b[1], originLat, originLng);
  const abx = pb.x - pa.x;
  const aby = pb.y - pa.y;
  const apx = p.x - pa.x;
  const apy = p.y - pa.y;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = pa.x + t * abx;
  const cy = pa.y + t * aby;
  return Math.hypot(p.x - cx, p.y - cy);
}

function segmentLengthMeters(a: LatLngTuple, b: LatLngTuple, originLat: number, originLng: number) {
  const pa = toLocalMeters(a[0], a[1], originLat, originLng);
  const pb = toLocalMeters(b[0], b[1], originLat, originLng);
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
}

/** Minimum distance (meters) from point to polyline. */
export function minDistanceToPolylineMeters(lat: number, lng: number, polyline: LatLngTuple[]): number {
  if (polyline.length < 2) return Infinity;
  const mid = polyline[Math.floor(polyline.length / 2)];
  const originLat = mid[0];
  const originLng = mid[1];
  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const d = pointSegmentDistanceMeters(lat, lng, polyline[i], polyline[i + 1], originLat, originLng);
    if (d < min) min = d;
  }
  return min;
}

/** Approximate distance along polyline to the closest point on the path (meters), for ordering. */
export function progressAlongPolylineMeters(lat: number, lng: number, polyline: LatLngTuple[]): number {
  if (polyline.length < 2) return 0;
  const mid = polyline[Math.floor(polyline.length / 2)];
  const originLat = mid[0];
  const originLng = mid[1];
  let best = { dist: Infinity, progress: 0 };
  let cumulative = 0;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segLen = segmentLengthMeters(a, b, originLat, originLng);
    const p = toLocalMeters(lat, lng, originLat, originLng);
    const pa = toLocalMeters(a[0], a[1], originLat, originLng);
    const pb = toLocalMeters(b[0], b[1], originLat, originLng);
    const abx = pb.x - pa.x;
    const aby = pb.y - pa.y;
    const apx = p.x - pa.x;
    const apy = p.y - pa.y;
    const ab2 = abx * abx + aby * aby;
    let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = pa.x + t * abx;
    const cy = pa.y + t * aby;
    const dist = Math.hypot(p.x - cx, p.y - cy);
    const progress = cumulative + t * segLen;
    if (dist < best.dist) best = { dist, progress };
    cumulative += segLen;
  }
  return best.progress;
}

function dedupeStops(stops: StopPoint[]): StopPoint[] {
  const seenByName = new Set<string>();
  const seenByCoord = new Set<string>();
  const out: StopPoint[] = [];
  for (const s of stops) {
    const normalizedName = s.stop_name.trim().toLowerCase().replace(/\s+/g, ' ');
    const coordKey = `${s.latitude.toFixed(5)}|${s.longitude.toFixed(5)}`;
    // Prevent repeated labels for same stop name and exact coordinate duplicates.
    if (seenByName.has(normalizedName) || seenByCoord.has(coordKey)) continue;
    seenByName.add(normalizedName);
    seenByCoord.add(coordKey);
    out.push(s);
  }
  return out;
}

/**
 * Stops whose distance to the route polyline is within maxDistanceMeters (corridor),
 * sorted along the path from source to destination.
 */
export function getStopsAlongPolyline(
  allStops: StopPoint[],
  polyline: LatLngTuple[],
  maxDistanceMeters = 400
): StopPoint[] {
  if (polyline.length < 2 || allStops.length === 0) return [];

  const nearby = allStops.filter((stop) => {
    const d = minDistanceToPolylineMeters(stop.latitude, stop.longitude, polyline);
    return d <= maxDistanceMeters;
  });

  const sorted = [...nearby].sort(
    (a, b) =>
      progressAlongPolylineMeters(a.latitude, a.longitude, polyline) -
      progressAlongPolylineMeters(b.latitude, b.longitude, polyline)
  );

  return dedupeStops(sorted);
}
