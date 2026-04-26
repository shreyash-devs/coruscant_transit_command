import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { generateHistoricalData } from '@/lib/mockData';
import type { ExternalFactors } from '@/lib/mockData';
import { useMemo } from 'react';
import { Cloud, TrafficCone, Calendar } from 'lucide-react';

interface DemandPanelProps {
  factors: ExternalFactors;
  accuracy: number;
}

export default function DemandPanel({ factors, accuracy }: DemandPanelProps) {
  const data = useMemo(() => generateHistoricalData(24), []);

  return (
    <div className="glass-panel p-4 space-y-4 h-full">
      <h3 className="font-display font-semibold text-sm uppercase tracking-wider">Demand Prediction</h3>

      {/* Chart */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(190,95%,50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(190,95%,50%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="predictedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(150,90%,45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(150,90%,45%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: 'hsl(220,25%,10%)', border: '1px solid hsl(220,20%,20%)', borderRadius: '8px', fontSize: '11px' }}
              labelStyle={{ color: 'hsl(210,40%,80%)' }}
            />
            <Area type="monotone" dataKey="actual" stroke="hsl(190,95%,50%)" fill="url(#actualGrad)" strokeWidth={2} name="Actual" />
            <Area type="monotone" dataKey="predicted" stroke="hsl(150,90%,45%)" fill="url(#predictedGrad)" strokeWidth={2} strokeDasharray="4 4" name="Predicted" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* AI Confidence */}
      <div className="glass-panel p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">AI Confidence</span>
          <span className="font-mono font-bold text-primary text-sm">{accuracy}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
            style={{ width: `${accuracy}%` }}
          />
        </div>
      </div>

      {/* External factors */}
      <div className="space-y-2">
        <h4 className="text-xs text-muted-foreground uppercase tracking-wider">External Factors</h4>
        <div className="grid grid-cols-1 gap-2">
          <FactorRow icon={<Cloud size={14} />} label="Weather" value={factors.weatherDesc} impact={Math.round(factors.weatherFactor * 100)} />
          <FactorRow icon={<TrafficCone size={14} />} label="Traffic" value={factors.trafficDesc} impact={Math.round(factors.trafficIndex * 100)} />
          <FactorRow icon={<Calendar size={14} />} label="Events" value={factors.eventDesc} impact={Math.round((factors.eventMultiplier - 1) * 100)} />
        </div>
      </div>
    </div>
  );
}

function FactorRow({ icon, label, value, impact }: { icon: React.ReactNode; label: string; value: string; impact: number }) {
  return (
    <div className="flex items-center justify-between text-xs bg-secondary/30 rounded-md px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-foreground font-medium">{value}</span>
        <span className={`font-mono ${impact > 30 ? 'text-neon-red' : impact > 15 ? 'text-neon-amber' : 'text-neon-green'}`}>
          {impact > 0 ? `+${impact}%` : `${impact}%`}
        </span>
      </div>
    </div>
  );
}
