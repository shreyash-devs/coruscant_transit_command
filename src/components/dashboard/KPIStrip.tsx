import { Bus, Clock, TrendingUp, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  color: string;
  glowClass: string;
}

function AnimatedValue({ value }: { value: string | number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setDisplay(value);
    }
  }, [value]);

  return <span className="animate-counter inline-block font-mono font-bold text-2xl">{display}</span>;
}

function KPICard({ icon, label, value, suffix, color, glowClass }: KPICardProps) {
  return (
    <div className={`glass-panel p-4 flex items-center gap-4 ${glowClass} transition-all duration-500`}>
      <div className={`p-2.5 rounded-lg bg-secondary ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <div className="flex items-baseline gap-1 mt-0.5">
          <AnimatedValue value={value} />
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

interface KPIStripProps {
  activeVehicles: number;
  avgWaitTime: number;
  accuracy: number;
  efficiency: number;
}

export default function KPIStrip({ activeVehicles, avgWaitTime, accuracy, efficiency }: KPIStripProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KPICard
        icon={<Bus size={20} />}
        label="Active Vehicles"
        value={activeVehicles}
        color="text-neon-cyan"
        glowClass="neon-glow"
      />
      <KPICard
        icon={<Clock size={20} />}
        label="Avg Wait Time"
        value={avgWaitTime}
        suffix="min"
        color="text-neon-amber"
        glowClass="neon-glow-amber"
      />
      <KPICard
        icon={<TrendingUp size={20} />}
        label="Forecast Accuracy"
        value={accuracy}
        suffix="%"
        color="text-neon-green"
        glowClass="neon-glow-green"
      />
      <KPICard
        icon={<Zap size={20} />}
        label="Fleet Efficiency"
        value={efficiency}
        suffix="%"
        color="text-neon-purple"
        glowClass=""
      />
    </div>
  );
}
