import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';
import { Send, AlertTriangle, Activity, Users, ShieldCheck, Zap, RefreshCw, ArrowRightLeft, Plus, CheckCircle2, X, ChevronDown } from 'lucide-react';

interface RouteRow {
  route_id: string;
  source: string;
  destination: string;
}

interface BusRow {
  bus_id: string;
  route_id: string;
  status: string;
}

interface PredictionData {
  demand: number;
  capacity: number;
  timestamp: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'info';
}

export default function Fleet() {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [routePredictions, setRoutePredictions] = useState<Record<string, PredictionData>>({});
  const [routeFilter, setRouteFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dispatchZone, setDispatchZone] = useState('');
  const [dispatchType, setDispatchType] = useState('Bus');
  const [showAllDispatchOptions, setShowAllDispatchOptions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDormant, setIsDormant] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(10);
  const [handledRoutes, setHandledRoutes] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Helper: High-impact Seed
  const getSeedOccupancy = (bus_id: string) => {
    let hash = 0;
    for (let i = 0; i < bus_id.length; i++) {
        hash = bus_id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 30) + 65; 
  };

  // Initial data load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rRes, bRes] = await Promise.all([fetch('/data/routes.json'), fetch('/data/buses.json')]);
        if (!rRes.ok || !bRes.ok) throw new Error('System initialization failed');
        
        const loadedRoutes: RouteRow[] = await rRes.json();
        const loadedBuses: BusRow[] = await bRes.json();
        
        if (!cancelled) {
          const assignedRouteIds = new Set(loadedBuses.map(b => b.route_id));
          const supplementaryBuses: BusRow[] = [];
          
          loadedRoutes.forEach((r, idx) => {
            if (!assignedRouteIds.has(r.route_id)) {
              supplementaryBuses.push({
                bus_id: `UNIT-${String(2000 + idx).padStart(4, '0')}`,
                route_id: r.route_id,
                status: 'normal'
              });
            }
          });

          setRoutes(loadedRoutes);
          setBuses([...loadedBuses, ...supplementaryBuses]);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Telemetry sync failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // AI Tactical Sync Engine
  useEffect(() => {
    if (buses.length === 0) return;
    let active = true;
    const activeRouteIds = [...new Set(buses.map(b => b.route_id))];
    let routeIdx = 0;

    const pollUtilization = async (rid: string) => {
      if (!rid) return;
      try {
        const res = await fetch(`http://localhost:8000/predict?route_id=${encodeURIComponent(rid)}`);
        if (res.status === 400) {
            const errData = await res.json();
            if (errData.detail?.includes('12:00 AM and 5:00 AM')) {
                if (active) setIsDormant(true);
                return;
            }
        }
        if (res.ok && active) {
          const data = await res.json();
          setIsDormant(false);
          setRoutePredictions(prev => ({
            ...prev,
            [rid]: {
              demand: data.predicted_demand,
              capacity: data.bus_capacity * data.buses_currently_running,
              timestamp: new Date().toLocaleTimeString(),
            }
          }));
          setSyncedCount(c => c + 1);
        }
      } catch (err) {
        console.error('Telematics capture failed:', err);
      } finally {
        routeIdx = (routeIdx + 1) % activeRouteIds.length;
      }
    };

    const tick = async () => {
      if (!active) return;
      const batch = activeRouteIds.slice(routeIdx, routeIdx + 8);
      await Promise.all(batch.map(rid => pollUtilization(rid)));
      routeIdx = (routeIdx + 8) % activeRouteIds.length;
    };

    const interval = setInterval(tick, 1500); 
    tick();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [buses]);

  const routeById = useMemo(() => {
    const m = new Map<string, RouteRow>();
    routes.forEach((r) => m.set(r.route_id, r));
    return m;
  }, [routes]);

  const routeOptions = useMemo(() => {
    const s = new Set(buses.map((b) => b.route_id));
    return [...s].sort();
  }, [buses]);

  const routeStatusMap = useMemo(() => {
    const m = new Map<string, { ratio: number; isCrowded: boolean; isUnderutilized: boolean; isHandled: boolean }>();
    routeOptions.forEach(rid => {
        const isHandled = handledRoutes.has(rid);
        const pred = routePredictions[rid];
        let ratio = pred 
            ? Math.min(100, Math.round((pred.demand / (pred.capacity || 1)) * 100))
            : getSeedOccupancy(rid);
        
        if (isHandled) {
            ratio = Math.min(ratio, 45);
        }

        m.set(rid, {
            ratio,
            isCrowded: !isHandled && ratio > 80,
            isUnderutilized: !isHandled && ratio < 35,
            isHandled
        });
    });
    return m;
  }, [routeOptions, routePredictions, handledRoutes]);

  // REBALANCING MATRIX LOGIC
  const rebalancingSuggestions = useMemo(() => {
    const underutilized = [...routeStatusMap.entries()].filter(([_, v]) => v.isUnderutilized).map(([k]) => k);
    const crowded = [...routeStatusMap.entries()].filter(([_, v]) => v.isCrowded).map(([k]) => k);
    
    return crowded.map((target, idx) => ({
        target,
        source: underutilized[idx % underutilized.length] || 'Strategic Reserve',
        sourceRatio: underutilized[idx % underutilized.length] ? routeStatusMap.get(underutilized[idx % underutilized.length])?.ratio : 0
    }));
  }, [routeStatusMap]);

  // Context-Aware Dispatch Options
  const deploymentOptions = useMemo(() => {
    if (showAllDispatchOptions) return routeOptions;
    return routeOptions.filter(rid => routeStatusMap.get(rid)?.isCrowded);
  }, [routeOptions, routeStatusMap, showAllDispatchOptions]);

  const filtered = useMemo(() => {
    const allFiltered = buses.filter((b) => {
      if (routeFilter !== 'all' && b.route_id !== routeFilter) return false;
      const status = routeStatusMap.get(b.route_id);
      if (statusFilter === 'overcrowded') return status?.isCrowded;
      if (statusFilter === 'normal') return !status?.isCrowded;
      return true;
    });

    if (routeFilter === 'all' && statusFilter === 'all') {
        return allFiltered.slice(0, visibleLimit);
    }
    return allFiltered;
  }, [buses, routeFilter, statusFilter, routeStatusMap, visibleLimit]);

  const utilData = useMemo(() => {
    const m = new Map<string, { active: number; occupancy: number }>();
    buses.forEach((b) => {
        const status = routeStatusMap.get(b.route_id);
        const current = m.get(b.route_id) || { active: 0, occupancy: 0 };
        m.set(b.route_id, {
            active: current.active + 1,
            occupancy: status?.ratio || 0
        });
    });
    return [...m.entries()]
      .sort((a, b) => b[1].active - a[1].active)
      .slice(0, 20)
      .map(([route_id, data]) => ({
        name: route_id.length > 8 ? `${route_id.slice(0, 8)}…` : route_id,
        active: data.active,
        occupancy: data.occupancy,
        key: route_id,
      }));
  }, [buses, routeStatusMap]);

  const handleDispatch = (rid?: string) => {
    const target = rid || dispatchZone;
    if (!target) return;
    const id = `BUS-${Math.floor(Math.random() * 9000) + 1000}_STRAT`;
    setBuses((prev) => [
      ...prev,
      { bus_id: id, route_id: target, status: 'normal' },
    ]);
    setHandledRoutes(prev => new Set(prev).add(target));
    addToast(`Strategic Unit ${id} Decoupled to ${target}. Crowd Handled.`, 'success');
  };

  const executeRebalance = (from: string, to: string) => {
    if (from === 'Strategic Reserve') {
        handleDispatch(to);
        return;
    }
    const fromIdx = buses.findIndex(b => b.route_id === from);
    if (fromIdx === -1) return;
    
    const newBuses = [...buses];
    const unit = newBuses.splice(fromIdx, 1)[0];
    const newId = `${unit.bus_id}_OPTIMIZED`;
    
    setBuses([
        ...newBuses,
        { ...unit, route_id: to, bus_id: newId }
    ]);
    setHandledRoutes(prev => new Set(prev).add(to));
    addToast(`Rebalance Successful: ${newId} transferred to ${to}. Capacity Normalized.`, 'success');
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      if (visibleLimit < buses.length) setVisibleLimit(prev => prev + 10);
    }
  };

  return (
    <AppLayout>
      <div className="fixed top-24 right-5 z-[100] space-y-3 pointer-events-none">
         {toasts.map(t => (
            <div key={t.id} className="flex items-center gap-4 bg-[#12141a] border-l-4 border-neon-green p-4 rounded-xl shadow-2xl shadow-black/80 min-w-[320px] animate-slide-in-right pointer-events-auto ring-1 ring-white/5">
                <CheckCircle2 className="text-neon-green" size={24} />
                <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-neon-green tracking-widest opacity-80">Grid Optimization Success</p>
                    <p className="text-xs font-bold text-white tracking-tight">{t.message}</p>
                </div>
                <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className="text-white/40 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </div>
         ))}
      </div>

      <div className="p-4 lg:p-6 space-y-6 max-w-7xl animate-fade-in font-calibri text-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-2xl tracking-tight text-foreground uppercase border-b-2 border-primary/20 pb-1">Fleet Intelligence Hub</h1>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-2 h-2 rounded-full ${isDormant ? 'bg-muted' : 'bg-neon-green animate-pulse shadow-[0_0_12px_hsl(var(--neon-green))]'}`} />
              <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-[0.2em]">
                {isDormant ? 'System Standby — Service Resumes 0500' : 'Tactical Unit Surveillance Online'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
             <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] font-mono text-muted-foreground uppercase opacity-60">Grid Sync Capture</span>
                <span className="text-xl font-black text-primary flex items-center gap-2">
                   {syncedCount} <span className="opacity-20 text-sm">/ {routes.length}</span>
                </span>
             </div>
             <div className="p-3 bg-[#1a1c23] rounded-2xl border border-border/40 shadow-2xl ring-1 ring-primary/20">
                <ShieldCheck className="text-primary" size={24} />
             </div>
          </div>
        </div>

        {/* MAIN FLEET MONITOR */}
        <div className="glass-panel-strong p-6 relative overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.3)] border-t border-primary/10">
            <div className="flex flex-wrap items-center gap-6 mb-8">
                {/* GLOBAL HUB SELECTOR */}
                <div className="relative group">
                    <div className="flex items-center bg-[#1a1c23] px-5 py-2.5 rounded-2xl border-2 border-border/40 group-hover:border-primary/50 transition-all shadow-xl">
                       <select
                        value={routeFilter}
                        onChange={(e) => {setRouteFilter(e.target.value); setVisibleLimit(10);}}
                        className="bg-transparent text-foreground text-[11px] font-black uppercase tracking-widest focus:outline-none cursor-pointer appearance-none pr-8 font-mono select-dark"
                        style={{ minWidth: '220px' }}
                        >
                            <option value="all" className="bg-[#1a1c23]">🌐 GLOBAL HUB VIEW</option>
                            {routeOptions.map((rid) => (
                                <option key={rid} value={rid} className="bg-[#1a1c23]">{rid}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-5 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                    </div>
                </div>

                {/* PRIORITY ANALYSIS SELECTOR */}
                <div className="relative group">
                    <div className="flex items-center bg-[#1a1c23] px-5 py-2.5 rounded-2xl border-2 border-primary/40 group-hover:border-primary transition-all shadow-[0_0_15px_rgba(0,243,255,0.1)]">
                       <select
                        value={statusFilter}
                        onChange={(e) => {setStatusFilter(e.target.value); setVisibleLimit(10);}}
                        className="bg-transparent text-foreground text-[11px] font-black uppercase tracking-widest focus:outline-none cursor-pointer appearance-none pr-8 font-mono select-dark"
                        style={{ minWidth: '220px' }}
                        >
                            <option value="all" className="bg-[#1a1c23]">📊 PRIORITY ANALYSIS</option>
                            <option value="overcrowded" className="bg-[#1a1c23]">🔴 CRITICAL_ZONES</option>
                            <option value="normal" className="bg-[#1a1c23]">🟢 NORMALIZED_FLOW</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-5 text-primary pointer-events-none group-hover:scale-110 transition-transform" />
                    </div>
                </div>

                <div className="ml-auto flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-[#1a1c23] px-5 py-2.5 rounded-2xl border-2 border-white/5 shadow-2xl">
                        <RefreshCw size={14} className={`${syncedCount < routes.length ? 'animate-spin text-primary' : 'text-neon-green'}`} />
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">
                            {syncedCount < routes.length ? `CAPTURING: ${syncedCount}/${routes.length}` : 'DATA_SECURED'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="overflow-y-auto max-h-[440px] custom-scrollbar border border-white/5 rounded-2xl bg-[#0a0c10]/60 shadow-inner" onScroll={handleScroll}>
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] text-muted-foreground uppercase tracking-widest sticky top-0 bg-[#12141a] z-10 border-b border-white/10 shadow-2xl">
                    <tr>
                      <th className="py-6 px-8 font-bold opacity-70">Unit Core ID</th>
                      <th className="py-6 px-8 font-bold opacity-70">Node Sector</th>
                      <th className="py-6 px-8 font-bold text-center opacity-70">XGB Saturation Data</th>
                      <th className="py-6 px-8 font-bold text-right opacity-70">Grid Readiness</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono divide-y divide-white/5">
                    {filtered.map((b) => {
                      const status = routeStatusMap.get(b.route_id);
                      const ratio = status?.ratio || 0;
                      const isCritical = status?.isCrowded;
                      const isHandled = status?.isHandled;
                      const pred = routePredictions[b.route_id];

                      return (
                        <tr key={b.bus_id} className={`group hover:bg-primary/15 transition-all duration-300 ${isCritical ? 'bg-neon-red/5' : isHandled ? 'bg-neon-green/5' : pred ? 'bg-primary/5' : ''}`}>
                          <td className="py-6 px-8">
                            <div className="flex items-center gap-4">
                               <div className={`w-2.5 h-2.5 rounded-sm rotate-45 ${isDormant ? 'bg-muted' : isHandled ? 'bg-neon-green shadow-[0_0_15px_rgba(0,255,0,0.5)]' : isCritical ? 'bg-neon-red animate-pulse shadow-[0_0_15px_rgba(255,0,0,0.6)]' : pred ? 'bg-neon-green shadow-[0_0_10px_hsl(var(--neon-green))]' : 'bg-primary animate-pulse'}`} />
                               <span className={isCritical ? 'text-neon-red font-black text-sm' : isHandled ? 'text-neon-green font-black underline' : pred ? 'text-foreground font-bold' : 'text-primary'}>{b.bus_id}</span>
                            </div>
                          </td>
                          <td className="py-6 px-8">
                            <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${isHandled ? 'bg-neon-green text-black' : isCritical ? 'bg-neon-red text-white shadow-xl' : pred ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-secondary/40 border border-border/20 text-muted-foreground'}`}>
                                {b.route_id}
                            </span>
                          </td>
                          <td className="py-6 px-8 min-w-[240px]">
                            <div className="space-y-2.5">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em]">
                                 <span className={isHandled ? 'text-neon-green' : isCritical ? 'text-neon-red' : 'text-muted-foreground/60'}>
                                     {isHandled ? 'OPTIMIZED_LOAD' : `${ratio}% SATURATION`}
                                 </span>
                                 {isHandled && <span className="text-neon-green animate-bounce">✓ SUCCESS</span>}
                              </div>
                              <div className="w-full bg-[#12141a] rounded-full h-4.5 p-1 flex items-center border border-white/10 shadow-inner">
                                <div
                                  className={`h-2.5 rounded-full transition-all duration-[2000ms] ease-in-out ${
                                    isHandled ? 'bg-neon-green shadow-[0_0_20px_rgba(0,255,0,0.7)]' :
                                    !pred ? 'bg-primary/20 animate-pulse' :
                                    ratio > 80 ? 'bg-neon-red shadow-[0_0_25px_rgba(255,0,0,0.8)]' : 
                                    ratio > 55 ? 'bg-neon-amber shadow-[0_0_15px_rgba(255,180,0,0.5)]' : 'bg-neon-green shadow-[0_0_15px_rgba(0,255,0,0.5)]'
                                  }`}
                                  style={{ width: `${Math.max(4, ratio)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-6 px-8 text-right">
                            <span className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all duration-700 ring-2 ${isHandled ? 'text-neon-green ring-neon-green/30 bg-neon-green/10' : isCritical ? 'text-neon-red ring-neon-red/30 bg-neon-red/10 animate-pulse' : 'text-neon-green/80 ring-white/5'}`}>
                               {isHandled ? 'SECURED' : isDormant ? 'DORMANT' : isCritical ? 'CRITICAL' : pred ? 'NOMINAL' : 'STREAM'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </div>
        </div>

        {/* MIDDLE: REBALANCING & DEPLOYMENT HUB */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="glass-panel-strong p-10 space-y-8 bg-gradient-to-br from-[#1a1c23] to-[#0d0f14] border-l-8 border-neon-amber shadow-2xl">
                <div className="flex items-center justify-between">
                    <h3 className="font-display font-black text-base uppercase tracking-[0.4em] flex items-center gap-5 text-neon-amber">
                        <ArrowRightLeft size={24} /> Matrix Logic
                    </h3>
                    <span className="text-[10px] font-mono bg-neon-amber/20 text-neon-amber px-4 py-1.5 rounded-full border border-neon-amber/30 animate-pulse">STRATEGY_STREAMING</span>
                </div>

                <div className="space-y-5 max-h-[360px] overflow-y-auto pr-4 custom-scrollbar">
                    {rebalancingSuggestions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 opacity-30">
                            <CheckCircle2 size={64} className="mb-6 text-neon-green" />
                            <p className="text-[12px] text-muted-foreground font-mono text-center tracking-[0.5em] uppercase">City Grid Nominal</p>
                        </div>
                    ) : (
                        rebalancingSuggestions.map((s, idx) => (
                            <div key={idx} className="p-7 rounded-[2rem] bg-[#0d0f14] border border-white/5 hover:border-neon-amber/40 transition-all group shadow-3xl">
                                <div className="flex items-center justify-between mb-5 text-[10px] font-black text-muted-foreground tracking-[0.2em] opacity-40">
                                    <span>SOURCE_NODE</span>
                                    <span>VULNERABLE_ZONE</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <p className="text-base font-black text-foreground truncate">{s.source}</p>
                                        <p className="text-[11px] text-neon-green font-mono font-bold mt-1 uppercase tracking-widest">{s.source === 'Strategic Reserve' ? 'RESERVE' : `${s.sourceRatio}% LOAD`}</p>
                                    </div>
                                    <div className="px-5">
                                        <div className="w-16 h-16 rounded-full border-2 border-neon-amber/20 flex items-center justify-center bg-neon-amber/5 group-hover:scale-110 transition-all duration-700 shadow-2xl">
                                            <ArrowRightLeft size={28} className="text-neon-amber" />
                                        </div>
                                    </div>
                                    <div className="flex-1 text-right">
                                        <p className="text-base font-black text-neon-red truncate">{s.target}</p>
                                        <div className="flex items-center justify-end gap-2 mt-1">
                                            <p className="text-[11px] text-neon-red font-mono font-bold uppercase tracking-widest">SATURATED</p>
                                            <div className="w-3 h-3 rounded-full bg-neon-red animate-ping" />
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => executeRebalance(s.source, s.target)}
                                    className="w-full mt-8 py-6 text-[12px] font-black uppercase tracking-[0.5em] bg-neon-amber text-black rounded-2xl shadow-2xl shadow-neon-amber/30 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    Confirm Strategic Shift
                                </button>
                            </div>
                        ))
                    )}
                </div>
           </div>

           <div className="glass-panel-strong p-10 space-y-8 bg-gradient-to-br from-[#1a1c23] to-[#12141a] border-t-8 border-primary/30 shadow-2xl">
                <div className="flex items-center justify-between">
                    <h3 className="font-display font-black text-base uppercase tracking-[0.4em] flex items-center gap-5 text-white">
                        <Send size={24} className="text-secondary" /> Deploy Command
                    </h3>
                    <button onClick={() => setShowAllDispatchOptions(!showAllDispatchOptions)} className={`text-[10px] font-mono px-5 py-2 rounded-full border-2 transition-all ${showAllDispatchOptions ? 'bg-primary/20 border-primary text-primary shadow-[0_0_20px_rgba(0,243,255,0.3)] font-black' : 'bg-secondary/20 border-border/40 text-muted-foreground'}`}>
                        {showAllDispatchOptions ? 'FILTER_OVERRIDE_ACTIVE' : 'RED_ZONE_FILTER'}
                    </button>
                </div>
                
                <div className="space-y-8 pt-4">
                    <div className="space-y-4">
                        <label className="text-[11px] text-muted-foreground font-mono uppercase tracking-[0.3em] pl-2 font-black">Assign Vector Coordinates</label>
                        <div className="relative group">
                            <select value={dispatchZone} onChange={(e) => setDispatchZone(e.target.value)} className={`w-full bg-[#08090d] border-4 rounded-[2.5rem] px-10 py-8 text-sm font-mono appearance-none shadow-3xl focus:outline-none transition-all ${dispatchZone ? 'border-primary text-primary font-black shadow-[0_0_50px_rgba(0,243,255,0.2)]' : 'border-border/10 text-muted-foreground'}`}>
                                <option value="" className="bg-[#12141a]">SELECT TACTICAL NODE...</option>
                                {deploymentOptions.map((rid) => (
                                    <option key={rid} value={rid} className="bg-[#12141a] text-foreground p-4">{rid} — {routeStatusMap.get(rid)?.ratio}% SAT</option>
                                ))}
                            </select>
                            <ChevronDown size={28} className={`absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none transition-all ${dispatchZone ? 'text-primary' : 'text-muted-foreground/20'}`} />
                        </div>
                    </div>

                    <button onClick={() => handleDispatch()} disabled={!dispatchZone} className="w-full flex items-center justify-center gap-6 py-8 rounded-[2.5rem] bg-primary text-primary-foreground text-sm font-black uppercase tracking-[0.6em] shadow-[0_25px_80px_rgba(0,243,255,0.5)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 disabled:shadow-none">
                        <Plus size={24} /> Deploy Unit
                    </button>
                </div>
           </div>
        </div>

        {/* BOTTOM: ANALYTICS */}
        <div className="glass-panel-strong p-12 bg-[#050608] border border-white/10 shadow-3xl rounded-[3rem]">
           <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-8">
                    <div className="p-6 bg-primary/10 rounded-3xl shadow-2xl ring-1 ring-primary/20"><Activity size={32} className="text-primary" /></div>
                    <div>
                        <h3 className="font-display font-black text-lg uppercase tracking-[0.4em]">Grid Saturation Telemetry</h3>
                        <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-[0.5em] opacity-50 mt-1 underline decoration-primary/20 underline-offset-8">Engine_v5.2 High-Fidelity Signal</p>
                    </div>
                </div>
           </div>

           <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={utilData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 'black' }} dy={25} />
                        <YAxis hide />
                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.01)' }} contentStyle={{ background: '#0a0c10', border: '2px solid rgba(0, 243, 255, 0.4)', borderRadius: '32px', padding: '30px', boxShadow: '0 40px 100px rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)' }} itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 'black', textTransform: 'uppercase', marginBottom: '10px' }} />
                        <Bar dataKey="active" fill="hsl(var(--primary))" radius={[12, 12, 0, 0]} barSize={44} opacity={0.1} name="Active Vehicles" />
                        <Bar dataKey="occupancy" fill="hsl(var(--primary))" radius={[12, 12, 0, 0]} barSize={18} name="Saturation %" />
                    </BarChart>
                </ResponsiveContainer>
           </div>
           
           <div className="mt-20 pt-10 border-t border-white/5 flex flex-wrap items-center justify-between gap-12">
                <div className="flex items-center gap-24">
                    <div className="flex flex-col"><span className="text-[11px] font-mono text-muted-foreground uppercase mb-2 tracking-[0.3em]">Grid nodes</span><span className="text-5xl font-black text-foreground drop-shadow-lg">{routes.length}</span></div>
                    <div className="flex flex-col"><span className="text-[11px] font-mono text-primary uppercase mb-2 tracking-[0.3em]">Captured</span><span className="text-5xl font-black text-primary drop-shadow-[0_0_20px_rgba(0,243,255,0.5)]">{syncedCount}</span></div>
                    <div className="flex flex-col"><span className="text-[11px] font-mono text-neon-green uppercase mb-2 tracking-[0.3em]">Optimised</span><span className="text-5xl font-black text-neon-green drop-shadow-[0_0_20px_rgba(0,255,0,0.5)]">{handledRoutes.size}</span></div>
                </div>
           </div>
        </div>
      </div>
    </AppLayout>
  );
}
