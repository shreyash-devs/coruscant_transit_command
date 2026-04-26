import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Zone, Vehicle, ExternalFactors,
  createInitialZones, createInitialVehicles, createExternalFactors,
  predictDemand
} from '@/lib/mockData';

export interface ScenarioMode {
  heavyRain: boolean;
  majorEvent: boolean;
  trafficSurge: boolean;
  peakHour: boolean;
}

export function useRealtimeData() {
  const [zones, setZones] = useState<Zone[]>(() => createInitialZones());
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => createInitialVehicles(createInitialZones()));
  const [factors, setFactors] = useState<ExternalFactors>(createExternalFactors);
  const [scenario, setScenario] = useState<ScenarioMode>({ heavyRain: false, majorEvent: false, trafficSurge: false, peakHour: false });
  const [avgWaitTime, setAvgWaitTime] = useState(8.5);
  const [accuracy, setAccuracy] = useState(87);
  const [efficiency, setEfficiency] = useState(72);
  const tickRef = useRef(0);

  const getEffectiveFactors = useCallback((): ExternalFactors => {
    const f = { ...factors };
    if (scenario.heavyRain) { f.weatherFactor = 0.5; f.weatherDesc = 'Heavy Rain'; }
    if (scenario.majorEvent) { f.eventMultiplier = 2.0; f.eventDesc = 'Major Stadium Event'; }
    if (scenario.trafficSurge) { f.trafficIndex = 0.95; f.trafficDesc = 'Congested'; }
    if (scenario.peakHour) { f.weatherFactor += 0.1; f.trafficIndex += 0.2; }
    return f;
  }, [factors, scenario]);

  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current++;
      const ef = getEffectiveFactors();

      setZones(prev => prev.map(z => {
        const variation = Math.random() * 30 - 15;
        const scenarioBoost = (scenario.majorEvent ? 40 : 0) + (scenario.peakHour ? 25 : 0);
        const newCurrent = Math.max(10, Math.round(z.baseDemand + variation + scenarioBoost));
        return {
          ...z,
          currentDemand: newCurrent,
          predictedDemand: predictDemand(newCurrent, ef),
        };
      }));

      setVehicles(prev => prev.map(v => ({
        ...v,
        occupancy: Math.min(100, Math.max(0, v.occupancy + Math.floor(Math.random() * 10 - 4))),
      })));

      setAvgWaitTime(prev => {
        const base = scenario.majorEvent ? 14 : scenario.peakHour ? 11 : 8;
        return Math.round((prev * 0.7 + (base + Math.random() * 4 - 2) * 0.3) * 10) / 10;
      });

      setAccuracy(prev => Math.min(95, Math.max(78, prev + (Math.random() * 4 - 2))));
      setEfficiency(prev => Math.min(95, Math.max(55, prev + (Math.random() * 6 - 3))));

      if (tickRef.current % 6 === 0) {
        setFactors(createExternalFactors());
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [getEffectiveFactors, scenario]);

  const rebalanceFleet = useCallback(() => {
    setZones(prev => prev.map(z => ({
      ...z,
      currentDemand: Math.round(z.currentDemand * 0.85),
    })));
    setAvgWaitTime(prev => Math.max(3, prev - 2.5));
    setEfficiency(prev => Math.min(95, prev + 8));
  }, []);

  const activeVehicles = vehicles.filter(v => v.status === 'Active').length;

  return {
    zones, vehicles, factors: getEffectiveFactors(),
    avgWaitTime, accuracy: Math.round(accuracy), efficiency: Math.round(efficiency),
    activeVehicles, totalVehicles: vehicles.length,
    scenario, setScenario,
    rebalanceFleet, setVehicles,
  };
}
