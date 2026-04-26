import { MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { MappedRoute } from '@/lib/routesMap';
import { useEffect, useMemo } from 'react';
import StopsLayer from '@/components/stops/StopsLayer';
import type { StopPoint } from '@/lib/stopsMap';

interface MapComponentProps {
  routes: MappedRoute[];
  selectedRouteId: string | null;
  hoveredRouteId: string | null;
  visibleRouteIds: Set<string>;
  showAll: boolean;
  onSelectRoute: (routeId: string) => void;
  onHoverRoute: (routeId: string | null) => void;
  hasSearch: boolean;
  geometryByRouteId: Record<string, [number, number][]>;
  stops: StopPoint[];
}

function hashColor(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = input.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 74%, 55%)`;
}

function FitToSelectedRoute({ positions }: { positions: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 1) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds.pad(0.2), { animate: true, duration: 0.7 });
    }
  }, [map, positions]);
  return null;
}

function FitToAllRoutes({ allPositions }: { allPositions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (allPositions.length < 2) return;
    const bounds = L.latLngBounds(allPositions);
    map.fitBounds(bounds.pad(0.08), { animate: true, duration: 0.7 });
  }, [map, allPositions]);
  return null;
}

export default function MapComponent({
  routes,
  selectedRouteId,
  hoveredRouteId,
  visibleRouteIds,
  showAll,
  onSelectRoute,
  onHoverRoute,
  hasSearch,
  geometryByRouteId,
  stops,
}: MapComponentProps) {
  const selectedRoute = useMemo(
    () => routes.find((route) => route.route_id === selectedRouteId),
    [routes, selectedRouteId]
  );
  const selectedRoutePositions = useMemo(() => {
    if (!selectedRoute) return null;
    const cached = geometryByRouteId[selectedRoute.route_id];
    if (cached && cached.length >= 2) return cached;
    return selectedRoute.points.map((point) => [point.lat, point.lng] as [number, number]);
  }, [selectedRoute, geometryByRouteId]);
  const allPositions = useMemo(
    () =>
      routes.flatMap((route) => {
        const cached = geometryByRouteId[route.route_id];
        if (cached && cached.length >= 2) return cached;
        return route.points.map((point) => [point.lat, point.lng] as [number, number]);
      }),
    [routes, geometryByRouteId]
  );

  return (
    <div className="glass-panel h-[70vh] overflow-hidden lg:h-[calc(100vh-16rem)]">
      <MapContainer center={[18.5204, 73.8567]} zoom={11} className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

        {hasSearch && selectedRoute ? (
          <FitToSelectedRoute positions={selectedRoutePositions} />
        ) : (
          <FitToAllRoutes allPositions={allPositions} />
        )}

        {routes.map((route) => {
          const cachedGeometry = geometryByRouteId[route.route_id];
          const positions = cachedGeometry && cachedGeometry.length >= 2
            ? cachedGeometry
            : route.points.map((point) => [point.lat, point.lng] as [number, number]);
          if (positions.length < 2) return null;
          const isSelected = route.route_id === selectedRouteId;
          const isHovered = route.route_id === hoveredRouteId;
          const isVisible = visibleRouteIds.has(route.route_id);
          const strokeColor = hashColor(route.route_id);

          const opacity = isSelected || isHovered
            ? 0.95
            : isVisible
              ? 0.85
              : showAll
                ? 0.12
                : 0;

          return (
            <Polyline
              key={route.route_id}
              positions={positions}
              pathOptions={{
                color: strokeColor,
                weight: isSelected ? 6 : isHovered ? 5 : 3.5,
                opacity,
              }}
              eventHandlers={{
                click: () => onSelectRoute(route.route_id),
                mouseover: () => onHoverRoute(route.route_id),
                mouseout: () => onHoverRoute(null),
              }}
            >
              <Popup>
                <div className="min-w-[220px] space-y-1">
                  <p className="text-sm font-semibold">{route.route_id}</p>
                  <p className="text-xs text-slate-600">
                    {route.from_stop} → {route.to_stop}
                  </p>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {stops.length > 0 && <StopsLayer stops={stops} />}
      </MapContainer>
    </div>
  );
}
