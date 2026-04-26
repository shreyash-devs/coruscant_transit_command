import AppLayout from '@/components/layout/AppLayout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FlaskConical } from 'lucide-react';

interface RouteRow {
  route_id: string;
  source: string;
  destination: string;
}

interface BusRow {
  bus_id: string;
  route_id: string;
  crowd_level: number;
  status: string;
}

type LatLngPath = [number, number][];

function interpolateAlong(path: LatLngPath, t: number): [number, number] {
  if (!path?.length) return [18.5204, 73.8567];
  if (path.length === 1) return path[0];
  const u = ((t % 1) + 1) % 1;
  const n = path.length - 1;
  const x = u * n;
  const i = Math.floor(x);
  const f = x - i;
  const a = path[i];
  const b = path[Math.min(i + 1, n)];
  return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
}

function hashColor(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = input.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 74%, 55%)`;
}

function FitRoutes({ paths }: { paths: LatLngPath[] }) {
  const map = useMap();
  useEffect(() => {
    const flat = paths.flat();
    if (flat.length < 2) return;
    const bounds = L.latLngBounds(flat.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds.pad(0.12), { animate: true, duration: 0.6 });
  }, [map, paths]);
  return null;
}

const busIconCache = new Map<string, L.DivIcon>();

function getBusIcon(hue: string) {
  if (!busIconCache.has(hue)) {
    busIconCache.set(
      hue,
      L.divIcon({
        className: 'sim-bus-marker',
        html: `<div style="font-size:20px;line-height:1;filter:drop-shadow(0 0 6px ${hue})">🚌</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    );
  }
  return busIconCache.get(hue)!;
}

function BusPopup({ bus, routeLabel }: { bus: BusRow; routeLabel: string }) {
  return (
    <Popup>
      <div className="text-xs font-mono min-w-[200px]">
        <p className="font-display font-semibold text-sm text-foreground mb-1">{bus.bus_id}</p>
        <p className="text-muted-foreground mb-1">{routeLabel}</p>
        <p className="text-neon-cyan">
          {bus.route_id} · crowd {bus.crowd_level}% · {bus.status}
        </p>
      </div>
    </Popup>
  );
}

export default function Simulation() {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [pathsByRoute, setPathsByRoute] = useState<Record<string, LatLngPath>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let id: number;
    const loop = () => {
      setTick((n) => n + 1);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rRes, bRes, pRes] = await Promise.all([
          fetch('/data/routes.json'),
          fetch('/data/buses.json'),
          fetch('/data/route_paths.json'),
        ]);
        if (!rRes.ok || !bRes.ok) throw new Error('Missing /data routes or buses');
        const rJson = (await rRes.json()) as RouteRow[];
        const bJson = (await bRes.json()) as BusRow[];
        let paths: Record<string, LatLngPath> = {};
        if (pRes.ok) {
          paths = (await pRes.json()) as Record<string, LatLngPath>;
        }
        if (!cancelled) {
          setRoutes(rJson);
          setBuses(bJson);
          setPathsByRoute(paths);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const routeById = useMemo(() => {
    const m = new Map<string, RouteRow>();
    routes.forEach((r) => m.set(r.route_id, r));
    return m;
  }, [routes]);

  const activePaths = useMemo(() => {
    const ids = new Set(buses.map((b) => b.route_id));
    const list: LatLngPath[] = [];
    ids.forEach((id) => {
      const p = pathsByRoute[id];
      if (p && p.length >= 2) list.push(p);
    });
    return list;
  }, [buses, pathsByRoute]);

  const busPositions = useMemo(() => {
    const now = performance.now();
    return buses.map((b, idx) => {
      const path = pathsByRoute[b.route_id];
      if (!path || path.length < 2) return { bus: b, pos: null as [number, number] | null };
      const period = 28000 + (b.bus_id.length % 10) * 800;
      const offset = idx / Math.max(1, buses.length);
      const t = (now / period + offset) % 1;
      return { bus: b, pos: interpolateAlong(path, t) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick drives animation refresh
  }, [buses, pathsByRoute, tick]);

  const polylineForRoute = useCallback(
    (routeId: string) => {
      const p = pathsByRoute[routeId];
      return p && p.length >= 2 ? p : null;
    },
    [pathsByRoute],
  );

  const uniqueRouteIds = useMemo(() => [...new Set(buses.map((b) => b.route_id))], [buses]);

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg tracking-wider">Simulation & Scenario Lab</h1>
            <p className="text-xs text-muted-foreground font-mono">Live route simulation with moving fleet</p>
          </div>
        </div>

        {loadError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-mono text-destructive">
            {loadError}
          </div>
        )}

        <div className="glass-panel overflow-hidden h-[min(72vh,720px)]">
          <MapContainer center={[18.5204, 73.8567]} zoom={11} className="h-full w-full" scrollWheelZoom>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            {activePaths.length > 0 && <FitRoutes paths={activePaths} />}

            {uniqueRouteIds.map((rid) => {
              const pts = polylineForRoute(rid);
              if (!pts) return null;
              const color = hashColor(rid);
              return (
                <Polyline
                  key={rid}
                  positions={pts}
                  pathOptions={{
                    color,
                    weight: 5,
                    opacity: 0.85,
                  }}
                />
              );
            })}

            {busPositions.map(({ bus, pos }) => {
              if (!pos) return null;
              const row = routeById.get(bus.route_id);
              const color = hashColor(bus.route_id);
              const icon = getBusIcon(color);
              const routeLabel = row ? `${row.source} → ${row.destination}` : bus.route_id;
              return (
                <Marker key={bus.bus_id} position={pos} icon={icon} zIndexOffset={600 + (bus.crowd_level % 50)}>
                  <BusPopup bus={bus} routeLabel={routeLabel} />
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <div className="glass-panel p-4">
          <div className="flex items-center gap-3 mb-3">
            <FlaskConical className="text-neon-amber" size={20} />
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider">Simulation notes</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Buses follow cached polylines for their <span className="font-mono text-foreground">route_id</span>. Routes without
            geometry in <span className="font-mono">/data/route_paths.json</span> are omitted from the map until geometry is
            available.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
