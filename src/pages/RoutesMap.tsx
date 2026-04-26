import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import PageHeader from '@/components/layout/PageHeader';
import SearchBar from '@/components/routes/SearchBar';
import RouteSidebar from '@/components/routes/RouteSidebar';
import MapComponent from '@/components/routes/MapComponent';
import {
  filterRoutes,
  mapRoutesToCoordinates,
  routesJsonToRawRoutes,
  stopPointsToRawStops,
  type RouteJsonRow,
  type RawRoute,
  type RawStop,
} from '@/lib/routesMap';
import { parseStopsWorkbook } from '@/lib/stopsMap';
import type { CachedRouteGeometry } from '@/lib/routingService';
import type { StopPoint } from '@/lib/stopsMap';
import { getStopsAlongPolyline, type LatLngTuple } from '@/lib/stopsAlongRoute';

const ROUTE_STOP_SNAP_DISTANCE_METERS = 60;

export default function RoutesMap() {
  const [rawRoutes, setRawRoutes] = useState<RawRoute[]>([]);
  const [rawStops, setRawStops] = useState<RawStop[]>([]);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(true);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState('Loading /data/routes.json and /data/stops.xlsx…');
  const [dataReady, setDataReady] = useState(false);
  const [geometryByRouteId, setGeometryByRouteId] = useState<Record<string, [number, number][]>>({});

  useEffect(() => {
    async function loadData() {
      try {
        const [routesRes, stopsRes] = await Promise.all([
          fetch('/data/routes.json'),
          fetch('/data/stops.xlsx'),
        ]);
        if (!routesRes.ok) {
          console.error('[RoutesMap] Missing /data/routes.json');
          setSourceLabel('Missing /public/data/routes.json — run npm run routes:json');
          setDataReady(true);
          return;
        }
        if (!stopsRes.ok) {
          console.error('[RoutesMap] Missing /data/stops.xlsx');
          setSourceLabel('Missing /public/data/stops.xlsx');
          setDataReady(true);
          return;
        }

        const routesJson = (await routesRes.json()) as RouteJsonRow[];
        const stopsBuffer = await stopsRes.arrayBuffer();
        const stopPoints = parseStopsWorkbook(stopsBuffer);
        const routes = routesJsonToRawRoutes(routesJson);
        const stops = stopPointsToRawStops(stopPoints);

        try {
          const geometryRes = await fetch('/data/routes_with_geometry.json');
          if (geometryRes.ok) {
            const geometries = (await geometryRes.json()) as CachedRouteGeometry[];
            const map: Record<string, [number, number][]> = {};
            for (const item of geometries) {
              if (item.route_id && Array.isArray(item.geometry) && item.geometry.length >= 2) {
                map[item.route_id] = item.geometry;
              }
            }
            setGeometryByRouteId(map);
          } else {
            console.warn('[RoutesMap] /data/routes_with_geometry.json not found. Using straight fallback geometry.');
          }
        } catch (geometryError) {
          console.warn('[RoutesMap] Failed to load cached geometry file. Using fallback geometry.', geometryError);
        }

        setRawRoutes(routes);
        setRawStops(stops);
        setSourceLabel(`Loaded ${routes.length} routes, ${stops.length} stops`);
      } catch (error) {
        console.error('[RoutesMap] Load failed', error);
        setSourceLabel('Failed to load data');
      } finally {
        setDataReady(true);
      }
    }
    loadData();
  }, []);

  const mappedRoutes = useMemo(() => mapRoutesToCoordinates(rawRoutes, rawStops), [rawRoutes, rawStops]);
  const drawableRoutes = useMemo(
    () => mappedRoutes.filter((route) => !route.isFailed && route.points.length >= 2),
    [mappedRoutes]
  );
  const matchedRoutes = useMemo(() => filterRoutes(drawableRoutes, search), [drawableRoutes, search]);
  const stopsForMap = useMemo<StopPoint[]>(
    () =>
      rawStops
        .map((stop) => ({
          stop_name: String(stop.stop_name).trim(),
          latitude: Number(stop.latitude),
          longitude: Number(stop.longitude),
        }))
        .filter(
          (stop) =>
            stop.stop_name &&
            Number.isFinite(stop.latitude) &&
            Number.isFinite(stop.longitude) &&
            stop.latitude >= -90 &&
            stop.latitude <= 90 &&
            stop.longitude >= -180 &&
            stop.longitude <= 180
        ),
    [rawStops]
  );

  /**
   * While searching with a selected route: show stops along the path (source → … → destination),
   * using a corridor around the road polyline (or straight line between endpoints).
   */
  const stopsForMapDisplay = useMemo(() => {
    if (!search.trim() || !selectedRouteId) return stopsForMap;
    const route = drawableRoutes.find((r) => r.route_id === selectedRouteId);
    if (!route || route.points.length < 2) return stopsForMap;

    const cached = geometryByRouteId[selectedRouteId];
    const polyline: LatLngTuple[] =
      cached && cached.length >= 2
        ? cached
        : route.points.map((p) => [p.lat, p.lng] as LatLngTuple);

    // Use strict snap distance so only stops that lie very close to the route are shown.
    const along = getStopsAlongPolyline(stopsForMap, polyline, ROUTE_STOP_SNAP_DISTANCE_METERS);
    if (along.length > 0) return along;

    return route.points.map((p) => ({
      stop_name: p.stopName,
      latitude: p.lat,
      longitude: p.lng,
    }));
  }, [search, selectedRouteId, drawableRoutes, stopsForMap, geometryByRouteId]);

  const visibleRouteIds = useMemo(() => {
    const allIds = new Set(drawableRoutes.map((route) => route.route_id));
    const matchedIds = new Set(matchedRoutes.map((route) => route.route_id));
    if (showAll) return search.trim() ? matchedIds : allIds;
    if (selectedRouteId) return new Set([selectedRouteId]);
    return search.trim() ? matchedIds : allIds;
  }, [drawableRoutes, matchedRoutes, search, showAll, selectedRouteId]);

  const activeRoutes = search.trim() ? matchedRoutes : drawableRoutes;

  useEffect(() => {
    if (!search.trim()) return;
    if (matchedRoutes.length === 0) {
      setSelectedRouteId(null);
      return;
    }
    if (!selectedRouteId || !matchedRoutes.some((route) => route.route_id === selectedRouteId)) {
      setSelectedRouteId(matchedRoutes[0].route_id);
    }
  }, [matchedRoutes, search, selectedRouteId]);

  const selectedRoute = drawableRoutes.find((route) => route.route_id === selectedRouteId) ?? null;
  const totalCount = drawableRoutes.length;
  const showingCount = showAll
    ? (search.trim() ? matchedRoutes.length : totalCount)
    : (selectedRouteId ? 1 : matchedRoutes.length);

  const skippedCount = mappedRoutes.filter((r) => r.isFailed).length;

  return (
    <AppLayout>
      <div className="space-y-4 p-4 lg:p-6">
        <PageHeader
          title="Routes Map"
          description="Source → destination polylines from local routes.json and stops.xlsx."
          rightContent={<span className="text-xs text-muted-foreground">{sourceLabel}</span>}
        />

        <SearchBar value={search} onChange={setSearch} showAll={showAll} onToggleShowAll={setShowAll} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>Showing {showingCount} out of {totalCount} drawable routes</p>
          <p>
            Total in JSON: {rawRoutes.length} | Skipped (missing stop): {skippedCount} | Stops visible:{' '}
            {search.trim() && selectedRouteId ? stopsForMapDisplay.length : stopsForMap.length}
            {search.trim() && selectedRouteId ? ' (along route)' : ''}
          </p>
        </div>

        {dataReady && drawableRoutes.length === 0 && rawRoutes.length === 0 && (
          <div className="glass-panel p-4 text-sm text-muted-foreground">
            No route data yet. Ensure <code className="text-foreground">public/data/routes.json</code> exists (run{' '}
            <code className="text-foreground">npm run routes:json</code>).
          </div>
        )}

        {dataReady && drawableRoutes.length === 0 && rawRoutes.length > 0 && (
          <div className="glass-panel p-4 text-sm text-muted-foreground">
            No routes could be drawn — check stop name matching between routes and stops.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px,1fr]">
          <RouteSidebar
            routes={activeRoutes}
            selectedRouteId={selectedRouteId}
            hoveredRouteId={hoveredRouteId}
            onHoverRoute={setHoveredRouteId}
            onSelectRoute={setSelectedRouteId}
          />
          <MapComponent
            routes={drawableRoutes}
            selectedRouteId={selectedRouteId}
            hoveredRouteId={hoveredRouteId}
            visibleRouteIds={visibleRouteIds}
            showAll={showAll}
            onSelectRoute={setSelectedRouteId}
            onHoverRoute={setHoveredRouteId}
            hasSearch={Boolean(search.trim())}
            geometryByRouteId={geometryByRouteId}
            stops={stopsForMapDisplay}
          />
        </div>

        {selectedRoute && (
          <div className="glass-panel p-4">
            <p className="text-sm font-semibold text-foreground">{selectedRoute.route_id}</p>
            <p className="text-xs text-muted-foreground">
              {selectedRoute.from_stop} → {selectedRoute.to_stop}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Mapped points: {selectedRoute.points.length}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
