import type { RawRoute, RawStop } from '@/lib/routesMap';

export const SAMPLE_ROUTES: RawRoute[] = [
  {
    route_id: 'R-100',
    from_stop: 'Pune Station',
    intermediate_stops: ['Shivajinagar', 'University Circle'],
    to_stop: 'Baner',
  },
  {
    route_id: 'R-120',
    from_stop: 'Swargate',
    intermediate_stops: ['Katraj Chowk', 'Bibwewadi'],
    to_stop: 'Market Yard',
  },
  {
    route_id: 'R-145',
    from_stop: 'Hinjewadi Phase 3',
    intermediate_stops: ['Wakad', 'Aundh', 'Shivajinagar'],
    to_stop: 'Pune Station',
  },
];

export const SAMPLE_STOPS: RawStop[] = [
  { stop_name: 'Pune Station', latitude: 18.5286, longitude: 73.8743 },
  { stop_name: 'Shivajinagar', latitude: 18.5314, longitude: 73.8446 },
  { stop_name: 'University Circle', latitude: 18.5535, longitude: 73.8249 },
  { stop_name: 'Baner', latitude: 18.559, longitude: 73.7868 },
  { stop_name: 'Swargate', latitude: 18.5018, longitude: 73.8636 },
  { stop_name: 'Katraj Chowk', latitude: 18.449, longitude: 73.8589 },
  { stop_name: 'Bibwewadi', latitude: 18.4774, longitude: 73.8675 },
  { stop_name: 'Market Yard', latitude: 18.4917, longitude: 73.8728 },
  { stop_name: 'Hinjewadi Phase 3', latitude: 18.5863, longitude: 73.6996 },
  { stop_name: 'Wakad', latitude: 18.598, longitude: 73.7585 },
  { stop_name: 'Aundh', latitude: 18.5584, longitude: 73.8077 },
];
