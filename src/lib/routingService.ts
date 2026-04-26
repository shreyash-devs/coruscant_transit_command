export type LatLng = [number, number];

export interface CachedRouteGeometry {
  route_id: string;
  source: string;
  destination: string;
  source_coords: LatLng;
  destination_coords: LatLng;
  geometry: LatLng[];
  usedFallback: boolean;
}

export function toLeafletLatLng(coordinates: [number, number][]): LatLng[] {
  return coordinates.map(([lng, lat]) => [lat, lng]);
}

export async function fetchOsrmRouteGeometry(
  source: LatLng,
  destination: LatLng
): Promise<LatLng[] | null> {
  const [sLat, sLng] = source;
  const [dLat, dLng] = destination;
  const url = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${dLng},${dLat}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = await response.json();
    const coords = payload?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (!coords || coords.length < 2) return null;
    return toLeafletLatLng(coords);
  } catch (error) {
    console.warn('[RoutingService] OSRM route fetch failed.', error);
    return null;
  }
}
