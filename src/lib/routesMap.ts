import Papa from 'papaparse';

export interface RawRoute {
  route_id: string;
  from_stop: string;
  to_stop: string;
  intermediate_stops?: string[] | string;
}

export interface RawStop {
  stop_name: string;
  latitude: number | string;
  longitude: number | string;
}

export interface RouteCoordinatePoint {
  stopName: string;
  lat: number;
  lng: number;
}

export interface MappedRoute {
  route_id: string;
  from_stop: string;
  to_stop: string;
  intermediate_stops: string[];
  points: RouteCoordinatePoint[];
  unmatchedStops: string[];
  isRenderable: boolean;
  isFailed: boolean;
}

/** Match stop names: trim, lowercase, collapse spaces (case-insensitive). */
export function normalizeStopName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeIntermediateStops(value?: string[] | string): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter(Boolean);
  return value
    .split(/[>|;,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseNumber(value: string | number) {
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(num) ? num : null;
}

function parseRouteDescriptionEndpoints(routeDescription: string) {
  // Supports "A To B", "A to B", and even "AToB" (best-effort).
  const normalized = routeDescription.trim();
  if (!normalized) return { from: '', to: '' };

  const match = normalized.match(/^(.*?)\s*to\s*(.*)$/i);
  if (!match) return { from: '', to: '' };
  return {
    from: (match[1] || '').trim(),
    to: (match[2] || '').trim(),
  };
}

export function parseRoutesCsv(csvText: string): RawRoute[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  const rows = parsed.data
    .map((row) => {
      const routeDescription = (row['Route Description'] || row.route_description || '').trim();
      let fromStop = (row.from_stop || row['from_stop'] || '').trim();
      let toStop = (row.to_stop || row['to_stop'] || '').trim();

      if (!fromStop || !toStop) {
        const parsedEndpoints = parseRouteDescriptionEndpoints(routeDescription);
        fromStop = fromStop || parsedEndpoints.from;
        toStop = toStop || parsedEndpoints.to;
      }

      return {
        route_id: (row.route_id || row['Route ID'] || row['route id'] || '').trim(),
        from_stop: fromStop,
        to_stop: toStop,
        intermediate_stops: row.intermediate_stops || row['intermediate stops'] || row['stops'],
      };
    });

  rows.forEach((row) => {
    if (!row.route_id) {
      console.warn('[RoutesMap] Missing route_id row encountered:', row);
    }
    if (!row.from_stop || !row.to_stop) {
      console.warn(`[RoutesMap] Route "${row.route_id || 'unknown'}" has missing endpoint fields`, {
        from_stop: row.from_stop,
        to_stop: row.to_stop,
      });
    }
  });

  // Keep all routes with identifiers so nothing is skipped silently.
  return rows.filter((r) => r.route_id);
}

export function parseStopsCsv(csvText: string): RawStop[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  return parsed.data
    .map((row) => ({
      stop_name: (
        row.stop_name ||
        row['Stop Name'] ||
        row['stop name'] ||
        row.stop ||
        row.name ||
        row['Bus Stop Name'] ||
        ''
      ).trim(),
      latitude: row.latitude || row.Latitude || row.lat || '',
      longitude: row.longitude || row.Longitude || row.lng || row.lon || row.long || '',
    }))
    .filter((s) => s.stop_name);
}

const cache = new WeakMap<RawRoute[], WeakMap<RawStop[], MappedRoute[]>>();

export function mapRoutesToCoordinates(routes: RawRoute[], stops: RawStop[]) {
  const stopCache = cache.get(routes);
  if (stopCache?.has(stops)) return stopCache.get(stops)!;

  const stopLookup = new Map<string, { lat: number; lng: number; stop_name: string }>();
  for (const stop of stops) {
    const lat = parseNumber(stop.latitude);
    const lng = parseNumber(stop.longitude);
    if (lat == null || lng == null) continue;
    stopLookup.set(normalizeStopName(stop.stop_name), { lat, lng, stop_name: stop.stop_name.trim() });
  }

  const mapped = routes.map<MappedRoute>((route) => {
    const orderedStops = [route.from_stop, ...normalizeIntermediateStops(route.intermediate_stops), route.to_stop];
    const points: RouteCoordinatePoint[] = [];
    const unmatchedStops: string[] = [];
    let fromFound = false;
    let toFound = false;

    for (let index = 0; index < orderedStops.length; index += 1) {
      const stopName = orderedStops[index];
      if (!stopName?.trim()) continue;
      const match = stopLookup.get(normalizeStopName(stopName));
      const isFrom = index === 0;
      const isTo = index === orderedStops.length - 1;
      if (!match) {
        unmatchedStops.push(stopName);
        continue;
      }
      if (isFrom) fromFound = true;
      if (isTo) toFound = true;
      points.push({ stopName: match.stop_name, lat: match.lat, lng: match.lng });
    }

    const isFailed = !fromFound || !toFound;
    const isRenderable = fromFound && toFound && points.length >= 2;

    if (unmatchedStops.length > 0) {
      console.warn(`[RoutesMap] route "${route.route_id}" has unmatched stops:`, unmatchedStops);
    }
    if (isFailed) {
      console.warn(`[RoutesMap] Skipping route "${route.route_id}" — source or destination not found in stops`, {
        from_stop: route.from_stop,
        to_stop: route.to_stop,
        fromFound,
        toFound,
        unmatchedStops,
      });
    }

    return {
      route_id: route.route_id,
      from_stop: route.from_stop,
      to_stop: route.to_stop,
      intermediate_stops: normalizeIntermediateStops(route.intermediate_stops),
      points,
      unmatchedStops,
      isRenderable,
      isFailed,
    };
  });

  const totalRoutes = mapped.length;
  const successfulRoutes = mapped.filter((route) => route.isRenderable).length;
  const failedRoutes = mapped.filter((route) => route.isFailed).length;

  console.info(`[RoutesMap] Total routes count: ${totalRoutes}`);
  console.info(`[RoutesMap] Successfully mapped routes count: ${successfulRoutes}`);
  console.info(`[RoutesMap] Failed routes count: ${failedRoutes}`);
  mapped
    .filter((route) => route.isFailed)
    .forEach((route) => {
      console.warn(`[RoutesMap] Skipped route "${route.route_id}":`, route.unmatchedStops);
    });

  const inner = stopCache ?? new WeakMap<RawStop[], MappedRoute[]>();
  inner.set(stops, mapped);
  cache.set(routes, inner);
  return mapped;
}

export function filterRoutes(routes: MappedRoute[], search: string) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return routes;
  return routes.filter((route) =>
    route.route_id.toLowerCase().includes(normalized) ||
    route.from_stop.toLowerCase().includes(normalized) ||
    route.to_stop.toLowerCase().includes(normalized)
  );
}

/** Shape of `public/data/routes.json` generated from SourceAndDestination.xlsx */
export interface RouteJsonRow {
  route_id: string;
  source: string;
  destination: string;
}

export function routesJsonToRawRoutes(rows: RouteJsonRow[]): RawRoute[] {
  return rows.map((row) => ({
    route_id: row.route_id,
    from_stop: row.source,
    to_stop: row.destination,
  }));
}

export function stopPointsToRawStops(
  points: Array<{ stop_name: string; latitude: number; longitude: number }>
): RawStop[] {
  return points.map((p) => ({
    stop_name: p.stop_name,
    latitude: p.latitude,
    longitude: p.longitude,
  }));
}
