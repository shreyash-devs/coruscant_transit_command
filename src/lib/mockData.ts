export interface Zone {
  id: string;
  name: string;
  baseDemand: number;
  currentDemand: number;
  predictedDemand: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Vehicle {
  id: string;
  type: 'Bus' | 'Metro' | 'Shared';
  zoneId: string;
  occupancy: number;
  status: 'Active' | 'Idle' | 'Maintenance';
}

export interface ExternalFactors {
  weatherFactor: number;
  trafficIndex: number;
  eventMultiplier: number;
  weatherDesc: string;
  trafficDesc: string;
  eventDesc: string;
}

export interface DemandLog {
  zoneId: string;
  timestamp: string;
  actualDemand: number;
  predictedDemand: number;
}

export const ZONE_NAMES = [
  'Central Hub', 'North Terminal', 'East Quarter', 'South Bay',
  'West Gate', 'Tech District', 'Harbor Point', 'University Zone',
  'Market Square', 'Airport Link', 'Industrial Park', 'Riverside'
];

export function createInitialZones(): Zone[] {
  const grid = [
    { x: 5, y: 5, w: 22, h: 28 },
    { x: 30, y: 5, w: 22, h: 28 },
    { x: 55, y: 5, w: 22, h: 28 },
    { x: 80, y: 5, w: 16, h: 28 },
    { x: 5, y: 36, w: 22, h: 28 },
    { x: 30, y: 36, w: 22, h: 28 },
    { x: 55, y: 36, w: 22, h: 28 },
    { x: 80, y: 36, w: 16, h: 28 },
    { x: 5, y: 67, w: 22, h: 28 },
    { x: 30, y: 67, w: 22, h: 28 },
    { x: 55, y: 67, w: 22, h: 28 },
    { x: 80, y: 67, w: 16, h: 28 },
  ];

  return ZONE_NAMES.map((name, i) => {
    const base = 50 + Math.floor(Math.random() * 150);
    return {
      id: `zone-${i + 1}`,
      name,
      baseDemand: base,
      currentDemand: base + Math.floor(Math.random() * 40 - 20),
      predictedDemand: base + Math.floor(Math.random() * 60 - 10),
      x: grid[i].x,
      y: grid[i].y,
      width: grid[i].w,
      height: grid[i].h,
    };
  });
}

export function createInitialVehicles(zones: Zone[]): Vehicle[] {
  const types: Vehicle['type'][] = ['Bus', 'Metro', 'Shared'];
  const vehicles: Vehicle[] = [];
  let id = 1;
  for (const zone of zones) {
    const count = 2 + Math.floor(Math.random() * 4);
    for (let j = 0; j < count; j++) {
      vehicles.push({
        id: `VH-${String(id++).padStart(4, '0')}`,
        type: types[Math.floor(Math.random() * types.length)],
        zoneId: zone.id,
        occupancy: Math.floor(Math.random() * 100),
        status: Math.random() > 0.15 ? (Math.random() > 0.3 ? 'Active' : 'Idle') : 'Maintenance',
      });
    }
  }
  return vehicles;
}

export function createExternalFactors(): ExternalFactors {
  return {
    weatherFactor: 0.1 + Math.random() * 0.3,
    trafficIndex: 0.5 + Math.random() * 0.5,
    eventMultiplier: Math.random() > 0.7 ? 1.3 + Math.random() * 0.7 : 1.0,
    weatherDesc: ['Clear', 'Cloudy', 'Light Rain', 'Heavy Rain', 'Storm'][Math.floor(Math.random() * 5)],
    trafficDesc: ['Light', 'Moderate', 'Heavy', 'Congested'][Math.floor(Math.random() * 4)],
    eventDesc: Math.random() > 0.7 ? 'Concert at Arena' : 'None',
  };
}

export function predictDemand(base: number, factors: ExternalFactors): number {
  return Math.round(
    base + (base * factors.weatherFactor) + (base * (factors.eventMultiplier - 1)) - (base * factors.trafficIndex * 0.2)
  );
}

export function generateHistoricalData(hours: number = 24): { time: string; actual: number; predicted: number }[] {
  const data = [];
  let base = 100;
  for (let i = 0; i < hours; i++) {
    const hour = i % 24;
    const peakFactor = hour >= 7 && hour <= 9 ? 2.2 : hour >= 17 && hour <= 19 ? 2.0 : hour >= 22 || hour <= 5 ? 0.4 : 1.0;
    const actual = Math.round(base * peakFactor + Math.random() * 40 - 20);
    const predicted = Math.round(actual * (0.85 + Math.random() * 0.15));
    data.push({ time: `${String(hour).padStart(2, '0')}:00`, actual, predicted });
  }
  return data;
}

export function getDemandLevel(current: number, base: number): 'low' | 'medium' | 'high' {
  const ratio = current / base;
  if (ratio < 0.9) return 'low';
  if (ratio < 1.3) return 'medium';
  return 'high';
}
