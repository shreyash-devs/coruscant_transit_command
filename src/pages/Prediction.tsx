import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPredictDemand, type PredictResponse, type CrowdLevel } from '@/lib/predictionApi';
import { BrainCircuit, Cloud, Loader2, TrafficCone, PartyPopper, CalendarIcon, Clock, Lightbulb, Bus, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface RouteRow { route_id: string; source: string; destination: string; }

function crowdBadgeClass(level: CrowdLevel): string {
  if (level === 'Low') return 'border-neon-green/40 bg-neon-green/10 text-neon-green';
  if (level === 'Medium') return 'border-neon-amber/40 bg-neon-amber/10 text-neon-amber';
  return 'border-destructive/40 bg-destructive/10 text-destructive';
}

export default function Prediction() {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [routeId, setRouteId] = useState<string>('');
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string>('');
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);
  useEffect(() => { let c = false; (async () => { try { const res = await fetch('/data/routes.json'); if (!res.ok) throw new Error('x'); const data = (await res.json()) as RouteRow[]; if (!c) { setRoutes(data); if (data.length) setRouteId(data[0].route_id); } } catch { if (!c) setError('Could not load routes'); } finally { if (!c) setLoadingRoutes(false); } })(); return () => { c = true; }; }, []);
  const sortedRoutes = useMemo(() => [...routes].sort((a, b) => a.route_id.localeCompare(b.route_id)), [routes]);
  async function onPredict() {
    if (!routeId || !date) return;
    setPredicting(true); setError(null); setResult(null);
    try {
      // Always send date. If no time picked, use current HH:MM so the server never uses its own clock.
      const selectedTime = time || new Date().toTimeString().slice(0, 5);
      setResult(await getPredictDemand(routeId, { date: format(date, 'yyyy-MM-dd'), time: selectedTime }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prediction failed');
    } finally {
      setPredicting(false);
    }
  }
  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-4 h-full">
        <div><h1 className="font-display font-bold text-lg tracking-wider flex items-center gap-2"><BrainCircuit className="text-primary" size={22} />Demand prediction</h1><p className="text-xs text-muted-foreground font-mono">ML inference</p></div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="glass-panel border-border/60"><CardHeader><CardTitle className="font-display text-base">Route</CardTitle><CardDescription>Select route and predict.</CardDescription></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Route</Label>{loadingRoutes ? <p className="text-xs text-muted-foreground">Loading</p> : <Select value={routeId} onValueChange={setRouteId}><SelectTrigger className="font-mono text-xs"><SelectValue placeholder="Route" /></SelectTrigger><SelectContent className="max-h-72">{sortedRoutes.map((r) => <SelectItem key={r.route_id} value={r.route_id} className="font-mono text-xs">{r.route_id}</SelectItem>)}</SelectContent></Select>}</div>
            <div className="rounded-lg border border-dashed p-3 space-y-2"><p className="text-[10px] font-mono uppercase text-muted-foreground">Select Date &amp; Time <span className="text-destructive font-semibold">*</span> <span className="text-muted-foreground/50 normal-case">(date required to predict)</span></p><div className="grid grid-cols-2 gap-2"><div className="flex flex-col space-y-1.5"><Label className="text-xs">Date <span className="text-destructive">*</span></Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("h-9 justify-start text-left font-mono text-xs font-normal border-border/50", !date && "text-muted-foreground border-destructive/50")}><CalendarIcon className="mr-2 h-3.5 w-3.5" />{date ? format(date, "PPP") : <span>Pick date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent></Popover></div><div className="flex flex-col space-y-1.5"><Label className="text-xs">Time <span className="text-[10px] text-muted-foreground">(05:00–23:30, optional)</span></Label><Select value={time} onValueChange={setTime}><SelectTrigger className="h-9 font-mono text-xs border-border/50"><div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 opacity-50" /><SelectValue placeholder="Defaults to now" /></div></SelectTrigger><SelectContent className="max-h-72">{Array.from({ length: 48 }).map((_, i) => { const h = Math.floor(i / 2); if (h < 5) return null; const val = `${h.toString().padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`; return <SelectItem key={val} value={val} className="font-mono text-xs">{val}</SelectItem>; })}</SelectContent></Select></div></div>{!date && <p className="text-[10px] text-destructive/80 font-mono">⚠ Please select a date to enable prediction.</p>}</div>
            <Button disabled={!routeId || predicting || loadingRoutes || !date} onClick={onPredict}>{predicting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Predicting</> : 'Predict demand'}</Button>
            {error && <p className="text-xs text-destructive border rounded-md px-2 py-1.5">{error}</p>}
          </CardContent></Card>
          <Card className="glass-panel border-border/60"><CardHeader><CardTitle className="font-display text-base">Forecast</CardTitle></CardHeader><CardContent className="space-y-4">
            {!result && !predicting && <p className="text-sm text-muted-foreground">Run prediction.</p>}
            {result && <><div><p className="text-xs text-muted-foreground uppercase">Predicted demand</p><p className="font-mono font-bold text-4xl mt-1">{result.predicted_demand}</p></div><div><p className="text-xs text-muted-foreground uppercase mb-2">Crowd level</p><span className={`inline-flex rounded-md border px-3 py-1 text-sm font-semibold ${crowdBadgeClass(result.crowd_level)}`}>{result.crowd_level}</span></div><div className="flex flex-wrap gap-2 pt-2"><Badge variant="outline" className="font-mono text-[10px] gap-1"><Cloud size={12} />{result.weather}</Badge><Badge variant="outline" className="font-mono text-[10px] gap-1"><TrafficCone size={12} />{result.traffic}</Badge><Badge variant="outline" className="font-mono text-[10px] gap-1"><PartyPopper size={12} />{result.event === 'nan' ? 'None' : result.event}</Badge></div>

            {/* Fleet Status Panel */}
            <div className="mt-4 rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-3">
              <div className="flex items-center gap-2"><Bus size={15} className="text-primary" /><p className="text-xs font-semibold uppercase tracking-wider">Fleet Status</p></div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-secondary/40 rounded-md p-2"><p className="text-[10px] text-muted-foreground uppercase">Currently Running</p><p className="font-mono font-bold text-xl mt-1">{result.buses_currently_running}</p><p className="text-[10px] text-muted-foreground">buses</p></div>
                <div className="bg-secondary/40 rounded-md p-2"><p className="text-[10px] text-muted-foreground uppercase">Model Says Needed</p><p className="font-mono font-bold text-xl mt-1">{result.buses_recommended}</p><p className="text-[10px] text-muted-foreground">buses</p></div>
                <div className="bg-secondary/40 rounded-md p-2"><p className="text-[10px] text-muted-foreground uppercase">Seat Capacity</p><p className="font-mono font-bold text-xl mt-1">{result.bus_capacity}</p><p className="text-[10px] text-muted-foreground">/bus</p></div>
              </div>
              <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${ result.fleet_action === 'increase' ? 'bg-destructive/10 border border-destructive/30 text-destructive' : result.fleet_action === 'reduce' ? 'bg-neon-green/10 border border-neon-green/30 text-neon-green' : 'bg-primary/10 border border-primary/30 text-primary' }`}>
                {result.fleet_action === 'increase' ? <TrendingUp size={14}/> : result.fleet_action === 'reduce' ? <TrendingDown size={14}/> : <CheckCircle2 size={14}/>}
                <span>{ result.fleet_action === 'increase' ? `Deploy ${result.buses_recommended - result.buses_currently_running} more bus(es)` : result.fleet_action === 'reduce' ? `Remove ${result.buses_currently_running - result.buses_recommended} bus(es)` : 'Fleet is optimal — no changes needed' }</span>
              </div>
            </div>

            {result.suggestions && result.suggestions.length > 0 && (<div className="mt-4 space-y-3 border-t border-border/50 pt-4"><div className="flex items-center gap-2"><Lightbulb className="text-neon-amber" size={16} /><h3 className="font-display font-semibold text-xs tracking-wider uppercase text-foreground">Actionable Insights</h3></div><ul className="space-y-2">{result.suggestions.map((suggestion, idx) => (<li key={idx} className="text-xs font-mono text-muted-foreground flex items-start gap-2 bg-secondary/30 p-2.5 rounded-md border border-border/40"><span className="text-primary mt-0.5">›</span><span>{suggestion}</span></li>))}</ul></div>)}</>}
          </CardContent></Card>
        </div></div>
    </AppLayout>
  );
}
