import { MapContainer, TileLayer } from 'react-leaflet';
import type { StopPoint } from '@/lib/stopsMap';
import StopsLayer from '@/components/stops/StopsLayer';

interface MapComponentProps {
  stops: StopPoint[];
  highlightedStopNames?: Set<string>;
}

export default function MapComponent({ stops, highlightedStopNames }: MapComponentProps) {
  return (
    <div className="h-[calc(100vh-12rem)] min-h-[600px] w-full overflow-hidden rounded-xl border border-border bg-card">
      <MapContainer center={[18.5204, 73.8567]} zoom={12} className="h-full w-full" preferCanvas>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <StopsLayer stops={stops} highlightedStopNames={highlightedStopNames} />
      </MapContainer>
    </div>
  );
}
