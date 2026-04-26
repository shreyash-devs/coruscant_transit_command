const baseUrl = () =>
  (import.meta.env.VITE_PREDICTION_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:8000';

export type CrowdLevel = 'Low' | 'Medium' | 'High';

export interface PredictResponse {
  route_id: string;
  predicted_demand: number;
  crowd_level: CrowdLevel;
  weather: string;
  traffic: string;
  event: string;
  suggestions: string[];
  buses_currently_running: number;
  bus_capacity: number;
  buses_recommended: number;
  fleet_action: string;
}

export interface PredictOptions {
  date?: string;
  time?: string;
}

export async function getPredictDemand(
  routeId: string,
  options?: PredictOptions,
): Promise<PredictResponse> {
  const params = new URLSearchParams({ route_id: routeId });
  if (options?.date) params.set('date', options.date);
  if (options?.time) params.set('time', options.time);
  const res = await fetch(`${baseUrl()}/predict?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Prediction failed (${res.status})`);
  }
  return res.json() as Promise<PredictResponse>;
}
