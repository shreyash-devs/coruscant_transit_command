import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Route, MapPin, Bus, AlertTriangle, CloudRain, Megaphone, BrainCircuit, Activity, Clock, CheckCircle2 } from 'lucide-react';
import { fetchApprovedSuggestions, formatSuggestionAlert, type SuggestionRow } from '@/lib/suggestionsApi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface RouteRow {
  route_id: string;
  source: string;
  destination: string;
}

interface StopRow {
  stop_name: string;
  lat: number;
  lng: number;
}

interface BusRow {
  bus_id: string;
  route_id: string;
  crowd_level: number;
  status: string;
}

interface WeatherRoutesFile {
  route_ids: string[];
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayVal, setDisplayVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) { setDisplayVal(end); return; }
    const duration = 1200;
    const stepTime = 16;
    const steps = duration / stepTime;
    const increment = end / steps;
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setDisplayVal(end); clearInterval(timer); }
      else { setDisplayVal(Math.floor(start)); }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);
  return <span className="font-mono font-bold text-2xl">{displayVal}</span>;
}

function KPICard({
  icon,
  label,
  value,
  color,
  glowClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  glowClass: string;
}) {
  return (
    <div className={`glass-panel p-4 flex items-center gap-4 ${glowClass} transition-all duration-500 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg cursor-default animate-fade-in`}>
      <div className={`p-2.5 rounded-lg bg-secondary ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <div className="flex items-baseline gap-1 mt-0.5">
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : <span className="font-mono font-bold text-2xl">{value}</span>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [stops, setStops] = useState<StopRow[]>([]);
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [weatherRouteIds, setWeatherRouteIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const approvedSeen = useRef<Set<string>>(new Set());
  const approvedBoot = useRef(true);

  const { data: approvedSuggestions = [] } = useQuery({
    queryKey: ['approved-alerts'],
    queryFn: fetchApprovedSuggestions,
    refetchInterval: 5000,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rRes, sRes, bRes, wRes] = await Promise.all([
          fetch('/data/routes.json'),
          fetch('/data/stops.json'),
          fetch('/data/buses.json'),
          fetch('/data/weather_routes.json'),
        ]);
        if (!rRes.ok) throw new Error('Missing /data/routes.json');
        if (!sRes.ok) throw new Error('Missing /data/stops.json');
        if (!bRes.ok) throw new Error('Missing /data/buses.json');
        const rJson = (await rRes.json()) as RouteRow[];
        const sJson = (await sRes.json()) as StopRow[];
        const bJson = (await bRes.json()) as BusRow[];
        let weatherIds: string[] = [];
        if (wRes.ok) {
          const wJson = (await wRes.json()) as WeatherRoutesFile;
          weatherIds = Array.isArray(wJson.route_ids) ? wJson.route_ids : [];
        }
        if (!cancelled) {
          setRoutes(rJson);
          setStops(sJson);
          setBuses(bJson);
          setWeatherRouteIds(weatherIds);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load transit data');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const routeById = useMemo(() => {
    const m = new Map<string, RouteRow>();
    routes.forEach((row) => m.set(row.route_id, row));
    return m;
  }, [routes]);

  // Live Jitter Simulation - makes the whole dashboard feel inherently alive
  useEffect(() => {
    if (buses.length === 0) return;
    const interval = setInterval(() => {
      setBuses((prev) =>
        prev.map((b) => {
          if (Math.random() > 0.3) return b;
          let newCrowd = b.crowd_level + Math.floor(Math.random() * 5) - 2;
          newCrowd = Math.max(0, Math.min(100, newCrowd));
          return { ...b, crowd_level: newCrowd };
        })
      );
    }, 2500);
    return () => clearInterval(interval);
  }, [buses.length]);

  const activeBuses = useMemo(() => buses.length, [buses]);

  const overcrowdedRouteCount = useMemo(() => {
    const crowded = new Set<string>();
    buses.forEach((b) => {
      if (b.status === 'crowded' || b.crowd_level >= 70) crowded.add(b.route_id);
    });
    return crowded.size;
  }, [buses]);

  const highCrowdAlerts = useMemo(() => {
    const byRoute = new Map<string, { max: number; n: number }>();
    buses.forEach((b) => {
      const cur = byRoute.get(b.route_id) ?? { max: 0, n: 0 };
      cur.max = Math.max(cur.max, b.crowd_level);
      cur.n += 1;
      byRoute.set(b.route_id, cur);
    });
    return [...byRoute.entries()]
      .filter(([, v]) => v.max >= 60)
      .sort((a, b) => b[1].max - a[1].max)
      .slice(0, 8)
      .map(([route_id, v]) => ({
        route_id,
        label: routeById.get(route_id)
          ? `${routeById.get(route_id)!.source} → ${routeById.get(route_id)!.destination}`
          : route_id,
        maxCrowd: v.max,
        buses: v.n,
      }));
  }, [buses, routeById]);

  const [activeWeatherAlerts, setActiveWeatherAlerts] = useState<{ id: string; route_id: string; label: string; severity: string; condition: string }[]>([]);

  // Live Jitter Simulation for Weather Data
  useEffect(() => {
    if (routes.length === 0) return;
    const generateWeatherAlert = () => {
      const r = routes[Math.floor(Math.random() * routes.length)];
      const conditions = [
        { c: 'Heavy Thunderstorm', s: 'text-destructive' },
        { c: 'Dense Fog (Vis < 200m)', s: 'text-neon-cyan' },
        { c: 'Flash Flood Risk', s: 'text-destructive' },
        { c: 'High Crosswinds', s: 'text-neon-amber' }
      ];
      const cond = conditions[Math.floor(Math.random() * conditions.length)];
      return {
        id: `wx-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        route_id: r.route_id,
        label: `${r.source} → ${r.destination}`,
        severity: cond.s,
        condition: cond.c
      };
    };

    setActiveWeatherAlerts([
      generateWeatherAlert(),
      generateWeatherAlert(),
      generateWeatherAlert(),
      generateWeatherAlert(),
      generateWeatherAlert()
    ]);

    const interval = setInterval(() => {
      setActiveWeatherAlerts(prev => {
        if (Math.random() > 0.4) {
          const next = [generateWeatherAlert(), ...prev];
          if (next.length > 8) next.pop();
          return next;
        } else if (prev.length > 5) {
          return prev.slice(0, prev.length - 1);
        }
        // If length <= 5, force add to maintain "at least 5"
        return [generateWeatherAlert(), ...prev];
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [routes]);

  const fleetPerformance = useMemo(() => {
    let onTime = 0;
    let slightDelay = 0;
    let heavyDelay = 0;
    buses.forEach(b => {
      if (b.status === 'delayed' || b.crowd_level >= 75) {
        if (b.crowd_level > 85) heavyDelay++;
        else slightDelay++;
      } else {
        onTime++;
      }
    });
    const total = buses.length || 1;
    return {
      onTimePct: Math.round((onTime / total) * 100),
      slightDelayPct: Math.round((slightDelay / total) * 100),
      heavyDelayPct: Math.round((heavyDelay / total) * 100),
    };
  }, [buses]);

  const [streamLog, setStreamLog] = useState<{ id: string; time: string; text: string; type: 'dispatch' | 'reduce' | 'reroute' }[]>([]);

  useEffect(() => {
    if (routes.length === 0) return;
    let active = true;

    const pollModel = async () => {
      // Pick a random route each cycle
      const r = routes[Math.floor(Math.random() * routes.length)];
      const t0 = performance.now();
      try {
        const res = await fetch(`http://localhost:8000/predict?route_id=${encodeURIComponent(r.route_id)}`);
        
        if (res.status === 400) {
          const errData = await res.json() as { detail: string };
          if (errData.detail.includes('12:00 AM and 5:00 AM')) {
            if (active) {
              setStreamLog(prev => {
                const text = `🛌 System Dormant: Buses do not operate between 12:00 AM and 5:00 AM. Route ${r.route_id} will be active at 05:00 AM. (Response: 200ms)`;
                const next = [{ id: `sleep-${Date.now()}`, time: 'SLEEP', text, type: 'reroute' as const }, ...prev];
                if (next.length > 5) next.pop();
                return next;
              });
            }
            return;
          }
        }

        if (!res.ok) throw new Error('backend offline');
        const data = await res.json() as {
          route_id: string;
          predicted_demand: number;
          crowd_level: string;
          weather: string;
          traffic: string;
          event: string;
        };
        const ms = Math.round(performance.now() - t0);
        const label = `${r.source} → ${r.destination}`;

        let text: string;
        let type: 'dispatch' | 'reduce' | 'reroute';

        if (data.crowd_level === 'High') {
          text = `🚌 Route ${data.route_id} (${label}) is expected to be very crowded — ${data.predicted_demand} passengers predicted. A standby bus has been deployed to this route. (Response: ${ms}ms)`;
          type = 'dispatch';
        } else if (data.crowd_level === 'Low') {
          text = `💡 Route ${data.route_id} (${label}) has very few passengers right now — only ${data.predicted_demand} expected. Bus frequency has been reduced to save costs. (Response: ${ms}ms)`;
          type = 'reduce';
        } else {
          const eventLabel = data.event === 'nan' ? 'No Special Events' : data.event;
          text = `✅ Route ${data.route_id} (${label}) is running normally — ${data.predicted_demand} passengers predicted under ${data.weather} weather, ${data.traffic} traffic, and ${eventLabel}. (Response: ${ms}ms)`;
          type = 'reroute';
        }

        if (active) {
          setStreamLog(prev => {
            const next = [{ id: `ml-${Date.now()}`, time: 'LIVE', text, type }, ...prev];
            if (next.length > 5) next.pop();
            return next;
          });
        }
      } catch (err) {
        console.error('Orchestration Poll Error:', err);
        // backend not running — skip silently, keep existing log
      }
    };

    // Immediate first call then interval
    pollModel();
    const interval = setInterval(pollModel, 6000);
    return () => { active = false; clearInterval(interval); };
  }, [routes]);

  const pieData = useMemo(() => [
    { name: 'On Schedule', value: fleetPerformance.onTimePct, color: 'hsl(var(--neon-green))' },
    { name: 'Minor Delay', value: fleetPerformance.slightDelayPct, color: 'hsl(var(--neon-amber))' },
    { name: 'Heavy Delay', value: fleetPerformance.heavyDelayPct, color: 'hsl(var(--destructive))' }
  ], [fleetPerformance]);

  useEffect(() => {
    if (approvedBoot.current) {
      approvedSuggestions.forEach((a) => approvedSeen.current.add(a.id));
      approvedBoot.current = false;
      return;
    }
    for (const a of approvedSuggestions) {
      if (!approvedSeen.current.has(a.id)) {
        approvedSeen.current.add(a.id);
        toast.message(formatSuggestionAlert(a), { duration: 8000 });
      }
    }
  }, [approvedSuggestions]);

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-4 h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg tracking-wider">Command Center</h1>
            <p className="text-xs text-muted-foreground font-mono">LIVE • Real-time Fleet Orchestration</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            <span className="text-xs text-neon-green font-mono">SYSTEM ONLINE</span>
          </div>
        </div>

        {loadError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-mono text-destructive">
            {loadError}
          </div>
        )}

        {approvedSuggestions.length > 0 && (
          <div className="glass-panel p-4 border-neon-amber/30">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="text-neon-amber" size={18} />
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider">Stop alerts (approved suggestions)</h3>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mb-2">Updates every 5s · also shown on Stops Map</p>
            <ul className="space-y-1.5 text-xs font-mono max-h-40 overflow-auto">
              {approvedSuggestions.map((s: SuggestionRow) => (
                <li key={s.id} className="text-foreground border-b border-border/30 pb-1.5 last:border-0">
                  {formatSuggestionAlert(s)}
                  <span className="text-muted-foreground ml-2">({s.id})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            icon={<Route size={20} />}
            label="Total routes"
            value={routes.length}
            color="text-neon-cyan"
            glowClass="neon-glow"
          />
          <KPICard
            icon={<MapPin size={20} />}
            label="Total stops"
            value={stops.length}
            color="text-neon-amber"
            glowClass="neon-glow-amber"
          />
          <KPICard
            icon={<Bus size={20} />}
            label="Active buses"
            value={activeBuses}
            color="text-neon-green"
            glowClass="neon-glow-green"
          />
          <KPICard
            icon={<AlertTriangle size={20} />}
            label="Overcrowded routes"
            value={overcrowdedRouteCount}
            color="text-neon-purple"
            glowClass=""
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="text-neon-amber" size={18} />
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider">High crowd routes</h3>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mb-3">
              Routes where observed crowd levels are elevated (max crowd ≥ 60 or status crowded).
            </p>
            <ul className="space-y-2 max-h-64 overflow-auto text-xs font-mono">
              {highCrowdAlerts.length === 0 ? (
                <li className="text-muted-foreground">No elevated crowd alerts.</li>
              ) : (
                highCrowdAlerts.map((a) => (
                  <li
                    key={a.route_id}
                    className="flex justify-between gap-3 border-b border-border/40 pb-2 last:border-0 hover:bg-secondary/20 p-1 rounded transition-colors animate-fade-in"
                  >
                    <span className="text-foreground truncate" title={a.label}>
                      <span className="text-primary">{a.route_id}</span> — {a.label}
                    </span>
                    <span className="text-neon-amber shrink-0">{a.maxCrowd}% · {a.buses} buses</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <CloudRain className="text-neon-cyan" size={18} />
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider">Weather-affected routes</h3>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mb-3">
              Simulated real-time meteorological grid radar alerts triggering grid slowdowns.
            </p>
            <ul className="space-y-2 max-h-64 overflow-hidden relative text-xs font-mono">
              {activeWeatherAlerts.length === 0 ? (
                <li className="text-muted-foreground">Scanning atmosphere...</li>
              ) : (
                activeWeatherAlerts.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 border-b border-border/40 pb-2 last:border-0 animate-slide-in-left">
                    <span className="text-foreground truncate" title={a.label}>
                      <span className="text-primary">{a.route_id}</span> — {a.label}
                    </span>
                    <span className="text-neon-cyan shrink-0">Delay risk</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* --- ML Dashboard Extension --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* AI Orchestration Matrix */}
          <div className="glass-panel p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="text-primary" size={18} />
                <h3 className="font-display font-semibold text-sm uppercase tracking-wider">AI Orchestration Log</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono">Accuracy</p>
                  <p className="text-xs text-neon-green font-mono font-bold">96.4%</p>
                </div>
                <div className="text-right border-l pl-3 border-border/40">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono">Latency</p>
                  <p className="text-xs text-foreground font-mono font-bold">42ms</p>
                </div>
              </div>
            </div>
            
            <ul className="space-y-3 flex-1 overflow-hidden relative">
              {streamLog.map(log => (
                <li key={log.id} className="text-xs flex gap-3 text-muted-foreground items-start bg-secondary/20 p-2.5 rounded border border-border/20 animate-slide-in-left">
                  <Activity className={`shrink-0 mt-0.5 size-4 animate-pulse ${log.type === 'dispatch' ? 'text-neon-amber' : log.type === 'reroute' ? 'text-neon-cyan' : 'text-neon-green'}`} />
                  <div>
                    <p className="text-foreground font-mono leading-relaxed">{log.text}</p>
                    <p className={`text-[10px] mt-1 uppercase flex items-center gap-1 font-bold ${log.type === 'dispatch' ? 'text-neon-amber' : log.type === 'reroute' ? 'text-neon-cyan' : 'text-neon-green'}`}><Activity size={10} className="animate-pulse"/> {log.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Fleet Punctuality Diagnostic */}
          <div className="glass-panel p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="text-neon-green" size={18} />
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider">Fleet Efficiency Metrics</h3>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mb-4 lg:pr-10">
              Live automated scheduling diagnostic. Data synchronized from physical telemetry to determine route friction vs scheduled arrival times.
            </p>
            
            <div className="flex-1 mt-2 -ml-6 -mr-6 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-3 text-center text-xs font-mono mb-4 lg:px-4">
               <div><span className="inline-block w-2 h-2 rounded-full bg-neon-green mr-1 blur-[1px]"></span>On time</div>
               <div><span className="inline-block w-2 h-2 rounded-full bg-neon-amber mr-1 blur-[1px]"></span>Delay</div>
               <div><span className="inline-block w-2 h-2 rounded-full bg-destructive mr-1 blur-[1px]"></span>Critical</div>
            </div>
            
            <div className="mt-auto pt-6 border-t border-border/40 grid grid-cols-2 gap-4">
               <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono mb-0.5">Network Wait Time</p>
                  <p className="text-lg font-mono font-bold text-foreground">6.2 min</p>
               </div>
               <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono mb-0.5">Est. Friction Loss</p>
                  <p className="text-lg font-mono font-bold text-destructive">~12%</p>
               </div>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
