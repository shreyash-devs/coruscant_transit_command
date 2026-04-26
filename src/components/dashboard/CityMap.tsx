import { useState } from 'react';
import { Zone, getDemandLevel } from '@/lib/mockData';
import { X } from 'lucide-react';

interface CityMapProps {
  zones: Zone[];
}

const DEMAND_COLORS = {
  low: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.5)', text: 'text-neon-green' },
  medium: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.5)', text: 'text-neon-amber' },
  high: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.5)', text: 'text-neon-red' },
};

export default function CityMap({ zones }: CityMapProps) {
  const [selected, setSelected] = useState<Zone | null>(null);

  return (
    <div className="glass-panel p-4 h-full relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-foreground">City Zone Map</h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-neon-green/40" /> Low</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-neon-amber/40" /> Medium</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-neon-red/40" /> High</span>
        </div>
      </div>

      <div className="relative w-full" style={{ paddingBottom: '65%' }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
          {/* Grid lines */}
          {[20, 40, 60, 80].map(v => (
            <g key={v}>
              <line x1={v} y1="0" x2={v} y2="100" stroke="hsl(220,20%,18%)" strokeWidth="0.2" />
              <line x1="0" y1={v} x2="100" y2={v} stroke="hsl(220,20%,18%)" strokeWidth="0.2" />
            </g>
          ))}

          {zones.map((zone) => {
            const level = getDemandLevel(zone.currentDemand, zone.baseDemand);
            const colors = DEMAND_COLORS[level];
            const isSelected = selected?.id === zone.id;

            return (
              <g key={zone.id} onClick={() => setSelected(zone)} className="cursor-pointer">
                <rect
                  x={zone.x} y={zone.y}
                  width={zone.width} height={zone.height}
                  rx="1.5"
                  fill={colors.bg}
                  stroke={isSelected ? 'hsl(190,95%,50%)' : colors.border}
                  strokeWidth={isSelected ? '0.6' : '0.3'}
                  className="transition-all duration-500"
                />
                <text
                  x={zone.x + zone.width / 2} y={zone.y + zone.height / 2 - 2}
                  textAnchor="middle" fontSize="2.2"
                  fill="hsl(210,40%,80%)" fontFamily="Space Grotesk"
                >
                  {zone.name}
                </text>
                <text
                  x={zone.x + zone.width / 2} y={zone.y + zone.height / 2 + 4}
                  textAnchor="middle" fontSize="3.5" fontWeight="bold"
                  fill={level === 'high' ? '#ef4444' : level === 'medium' ? '#f59e0b' : '#10b981'}
                  fontFamily="JetBrains Mono"
                >
                  {zone.currentDemand}
                </text>
                {/* Pulse for high demand */}
                {level === 'high' && (
                  <circle
                    cx={zone.x + zone.width / 2} cy={zone.y + 4}
                    r="1.5" fill="#ef4444"
                    className="animate-pulse-slow"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Zone detail popup */}
      {selected && (
        <div className="absolute bottom-4 right-4 glass-panel-strong p-4 w-64 animate-fade-in">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-display font-bold text-primary text-sm">{selected.name}</h4>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between"><span className="text-muted-foreground">Current Demand</span><span className="text-foreground">{selected.currentDemand}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Predicted (30m)</span><span className="text-primary">{selected.predictedDemand}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Base Demand</span><span className="text-foreground">{selected.baseDemand}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
              <span className={getDemandLevel(selected.currentDemand, selected.baseDemand) === 'high' ? 'text-neon-red' : getDemandLevel(selected.currentDemand, selected.baseDemand) === 'medium' ? 'text-neon-amber' : 'text-neon-green'}>
                {getDemandLevel(selected.currentDemand, selected.baseDemand).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
