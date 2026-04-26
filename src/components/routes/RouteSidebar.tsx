import type { MappedRoute } from '@/lib/routesMap';

interface RouteSidebarProps {
  routes: MappedRoute[];
  selectedRouteId: string | null;
  hoveredRouteId: string | null;
  onHoverRoute: (routeId: string | null) => void;
  onSelectRoute: (routeId: string) => void;
}

export default function RouteSidebar({
  routes,
  selectedRouteId,
  hoveredRouteId,
  onHoverRoute,
  onSelectRoute,
}: RouteSidebarProps) {
  return (
    <aside className="glass-panel flex h-[70vh] flex-col overflow-hidden lg:h-[calc(100vh-16rem)]">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Routes</h2>
        <p className="text-xs text-muted-foreground">{routes.length} route(s)</p>
      </div>
      <div className="space-y-2 overflow-auto p-3">
        {routes.map((route) => {
          const isSelected = selectedRouteId === route.route_id;
          const isHovered = hoveredRouteId === route.route_id;
          return (
            <button
              key={route.route_id}
              onMouseEnter={() => onHoverRoute(route.route_id)}
              onMouseLeave={() => onHoverRoute(null)}
              onClick={() => onSelectRoute(route.route_id)}
              className={`w-full rounded-md border px-3 py-2 text-left transition ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : isHovered
                    ? 'border-primary/60 bg-secondary'
                    : 'border-border bg-background hover:bg-secondary/60'
              }`}
            >
              <div className="text-sm font-semibold text-foreground">{route.route_id}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {route.from_stop} → {route.to_stop}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
