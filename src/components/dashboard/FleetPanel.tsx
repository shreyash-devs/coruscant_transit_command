import { Zone, getDemandLevel } from '@/lib/mockData';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface FleetPanelProps {
  zones: Zone[];
  efficiency: number;
  idleVehicles: number;
  onRebalance: () => void;
}

export default function FleetPanel({ zones, efficiency, idleVehicles, onRebalance }: FleetPanelProps) {
  const [rebalancing, setRebalancing] = useState(false);

  const underServed = zones.filter(z => getDemandLevel(z.currentDemand, z.baseDemand) === 'high');
  const overSupplied = zones.filter(z => getDemandLevel(z.currentDemand, z.baseDemand) === 'low');

  const handleRebalance = () => {
    setRebalancing(true);
    setTimeout(() => {
      onRebalance();
      setRebalancing(false);
    }, 2000);
  };

  return (
    <div className="glass-panel p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm uppercase tracking-wider">Fleet Rebalancing</h3>
        <button
          onClick={handleRebalance}
          disabled={rebalancing}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all
            ${rebalancing
              ? 'bg-primary/20 text-primary cursor-wait'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 neon-glow'}`}
        >
          <RefreshCw size={14} className={rebalancing ? 'animate-spin' : ''} />
          {rebalancing ? 'Rebalancing...' : 'Auto Rebalance'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBlock label="Under-served" value={underServed.length} color="text-neon-red" />
        <StatBlock label="Over-supplied" value={overSupplied.length} color="text-neon-green" />
        <StatBlock label="Idle Units" value={idleVehicles} color="text-neon-amber" />
      </div>

      {/* Utilization bar */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Fleet Utilization</span>
          <span className="font-mono text-foreground">{efficiency}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-1000 ${
              efficiency > 80 ? 'bg-neon-green' : efficiency > 60 ? 'bg-neon-amber' : 'bg-neon-red'
            }`}
            style={{ width: `${efficiency}%` }}
          />
        </div>
      </div>

      {/* Under-served zones list */}
      {underServed.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Critical Zones</h4>
          {underServed.slice(0, 3).map(z => (
            <div key={z.id} className="flex justify-between items-center bg-neon-red/5 border border-neon-red/20 rounded-md px-3 py-1.5 text-xs">
              <span className="text-foreground">{z.name}</span>
              <span className="font-mono text-neon-red">{z.currentDemand}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-secondary/30 rounded-md p-3 text-center">
      <p className={`font-mono font-bold text-xl ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
