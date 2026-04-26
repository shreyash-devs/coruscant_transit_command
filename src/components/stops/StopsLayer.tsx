import { Marker, Popup, Tooltip } from 'react-leaflet';
import { divIcon } from 'leaflet';
import type { StopPoint } from '@/lib/stopsMap';

interface StopsLayerProps {
  stops: StopPoint[];
  /** Canonical stop names (from master list) to highlight as approved alerts. */
  highlightedStopNames?: Set<string>;
}

const busIcon = divIcon({
  className: 'stop-marker-icon',
  html: '<div class="stop-marker-dot"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const alertIcon = divIcon({
  className: 'stop-marker-icon',
  html: '<div class="stop-marker-dot stop-marker-dot-alert"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function isHighlighted(stop: StopPoint, highlighted?: Set<string>) {
  if (!highlighted || highlighted.size === 0) return false;
  const n = stop.stop_name.trim();
  if (highlighted.has(n)) return true;
  return [...highlighted].some((h) => n.toLowerCase().includes(h.toLowerCase()) || h.toLowerCase().includes(n.toLowerCase()));
}

export default function StopsLayer({ stops, highlightedStopNames }: StopsLayerProps) {
  return (
    <>
      {stops.map((stop, index) => (
        <Marker
          key={`${stop.stop_name}-${index}`}
          position={[stop.latitude, stop.longitude]}
          icon={isHighlighted(stop, highlightedStopNames) ? alertIcon : busIcon}
        >
          <Popup>{stop.stop_name}</Popup>
          <Tooltip direction="top" offset={[0, -8]} className="stop-label-tooltip">
            {stop.stop_name}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
