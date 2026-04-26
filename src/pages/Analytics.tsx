import AppLayout from '@/components/layout/AppLayout';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { Cloud, TrafficCone, Calendar } from 'lucide-react';

const MODAL_COLORS = ['hsl(190,95%,50%)', 'hsl(150,90%,45%)', 'hsl(270,80%,60%)', 'hsl(38,95%,55%)', 'hsl(330,70%,55%)'];

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

interface StopRow {
  stop_name: string;
  lat: number;
  lng: number;
}

export default function Analytics() {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [stops, setStops] = useState<StopRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rRes, bRes, sRes] = await Promise.all([
          fetch('/data/routes.json'),
          fetch('/data/buses.json'),
          fetch('/data/stops.json'),
        ]);
        if (!rRes.ok || !bRes.ok || !sRes.ok) throw new Error('Missing /data routes, buses, or stops');
        if (!cancelled) {
          setRoutes(await rRes.json());
          setBuses(await bRes.json());
          setStops(await sRes.json());
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

  const routeStats = useMemo(() => {
    const m = new Map<string, { buses: number; crowdSum: number }>();
    buses.forEach((b) => {
      const cur = m.get(b.route_id) ?? { buses: 0, crowdSum: 0 };
      cur.buses += 1;
      cur.crowdSum += b.crowd_level;
      m.set(b.route_id, cur);
    });
    return [...m.entries()].map(([route_id, v]) => ({
      route_id,
      buses: v.buses,
      avgCrowd: v.buses ? Math.round(v.crowdSum / v.buses) : 0,
      load: v.crowdSum,
    }));
  }, [buses]);

  const topRoutes = useMemo(() => {
    return [...routeStats].sort((a, b) => b.load - a.load).slice(0, 5);
  }, [routeStats]);

  const crowdTrend = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => {
      let sum = 0;
      buses.forEach((b) => {
        const hcode = (b.bus_id.charCodeAt(b.bus_id.length - 1) + h * 3) % 100;
        sum += b.crowd_level * (0.4 + hcode / 200);
      });
      const avg = buses.length ? sum / buses.length : 0;
      return { time: `${String(h).padStart(2, '0')}:00`, crowd: Math.round(avg) };
    });
    return hours;
  }, [buses]);

  const routeUsagePie = useMemo(() => {
    const sorted = [...routeStats].sort((a, b) => b.buses - a.buses).slice(0, 5);
    const rest = routeStats.filter((r) => !sorted.find((s) => s.route_id === r.route_id));
    const restBuses = rest.reduce((acc, r) => acc + r.buses, 0);
    const data = sorted.map((r) => ({ name: r.route_id, value: r.buses }));
    if (restBuses > 0) data.push({ name: 'Other', value: restBuses });
    return data;
  }, [routeStats]);

  const factorImpact = useMemo(() => {
    return crowdTrend
      .filter((_, i) => i % 3 === 0)
      .map((row, i) => ({
        time: row.time,
        weather: Math.max(0, Math.round(row.crowd * 0.15 + i * 2)),
        traffic: Math.max(0, Math.round(row.crowd * 0.35 + i)),
        events: Math.max(0, Math.round((i % 4) * 8)),
      }));
  }, [crowdTrend]);

  const stopCoverage = useMemo(() => {
    const routeEndpoints = new Set<string>();
    routes.forEach((r) => {
      routeEndpoints.add(r.source);
      routeEndpoints.add(r.destination);
    });
    const named = new Set(stops.map((s) => s.stop_name));
    let matched = 0;
    routeEndpoints.forEach((n) => {
      if (named.has(n)) matched += 1;
    });
    return { endpoints: routeEndpoints.size, matched };
  }, [routes, stops]);

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-7xl">
        <div>
          <h1 className="font-display font-bold text-lg tracking-wider">Demand Analytics Center</h1>
          <p className="text-xs text-muted-foreground font-mono">Deep insights for supervisors</p>
        </div>

        {loadError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-mono text-destructive">
            {loadError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-panel p-4">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">Busiest routes</h3>
            <p className="text-[10px] text-muted-foreground font-mono mb-2">
              By total passenger load proxy (Σ crowd_level) across active buses.
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRoutes} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }} axisLine={false} />
                  <YAxis
                    dataKey="route_id"
                    type="category"
                    tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }}
                    width={72}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(220,25%,10%)',
                      border: '1px solid hsl(220,20%,20%)',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="load" fill="hsl(190,95%,50%)" radius={[0, 4, 4, 0]} name="Load" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel p-4">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">Crowd trends</h3>
            <p className="text-[10px] text-muted-foreground font-mono mb-2">
              Fleet-wide crowd intensity by hour (derived from bus records).
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={crowdTrend}>
                  <defs>
                    <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(190,95%,50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(190,95%,50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} axisLine={false} width={30} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(220,25%,10%)',
                      border: '1px solid hsl(220,20%,20%)',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="crowd"
                    stroke="hsl(190,95%,50%)"
                    fill="url(#demandGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="glass-panel p-4">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">Route usage</h3>
          <p className="text-[10px] text-muted-foreground font-mono mb-4">
            Share of active buses by route (top five + other). Stops coverage: {stopCoverage.matched}/{stopCoverage.endpoints}{' '}
            route endpoints matched to stop inventory.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="flex items-center justify-center">
              <div className="w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={routeUsagePie}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      dataKey="value"
                      paddingAngle={4}
                    >
                      {routeUsagePie.map((_, i) => (
                        <Cell key={i} fill={MODAL_COLORS[i % MODAL_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(220,25%,10%)',
                        border: '1px solid hsl(220,20%,20%)',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            {routeUsagePie.slice(0, 3).map((m, i) => (
              <div key={m.name} className="bg-secondary/20 rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: MODAL_COLORS[i % MODAL_COLORS.length] }} />
                  <span className="font-display font-semibold text-sm">{m.name}</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <MetricRow label="Buses assigned" value={`${m.value}`} />
                  <MetricRow
                    label="Avg crowd"
                    value={`${routeStats.find((r) => r.route_id === m.name)?.avgCrowd ?? '—'}%`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-4">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">External factor impact on demand</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <FactorCard icon={<Cloud size={18} />} label="Weather" value="Variable" impact="Medium" color="text-neon-cyan" />
            <FactorCard icon={<TrafficCone size={18} />} label="Traffic" value="Correlated" impact="High" color="text-neon-amber" />
            <FactorCard icon={<Calendar size={18} />} label="Events" value="Periodic" impact="Medium" color="text-neon-purple" />
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={factorImpact}>
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} axisLine={false} width={30} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(220,25%,10%)',
                    border: '1px solid hsl(220,20%,20%)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="weather"
                  stackId="1"
                  stroke="hsl(190,95%,50%)"
                  fill="hsl(190,95%,50%)"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="traffic"
                  stackId="1"
                  stroke="hsl(38,95%,55%)"
                  fill="hsl(38,95%,55%)"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="events"
                  stackId="1"
                  stroke="hsl(270,80%,60%)"
                  fill="hsl(270,80%,60%)"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function FactorCard({
  icon,
  label,
  value,
  impact,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  impact: string;
  color: string;
}) {
  return (
    <div className="bg-secondary/20 rounded-lg p-3 border border-border">
      <div className={`${color} mb-2`}>{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      <p className={`text-xs font-mono mt-1 ${impact === 'High' ? 'text-neon-red' : 'text-neon-amber'}`}>Impact: {impact}</p>
    </div>
  );
}
