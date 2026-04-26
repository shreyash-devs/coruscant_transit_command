import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import PageHeader from '@/components/layout/PageHeader';
import MapComponent from '@/components/stops/MapComponent';
import { parseStopsWorkbook, type StopPoint } from '@/lib/stopsMap';
import { fetchApprovedSuggestions } from '@/lib/suggestionsApi';

export default function StopsMap() {
  const [stops, setStops] = useState<StopPoint[]>([]);
  const [sourceLabel, setSourceLabel] = useState('Loading stops…');

  const { data: approved = [] } = useQuery({
    queryKey: ['approved-alerts'],
    queryFn: fetchApprovedSuggestions,
    refetchInterval: 5000,
  });

  const highlightedStopNames = useMemo(() => {
    const s = new Set<string>();
    for (const a of approved) {
      if (a.stop_name && a.stop_name !== 'Unknown') {
        s.add(a.stop_name.trim());
      }
    }
    return s;
  }, [approved]);

  useEffect(() => {
    async function loadDefaultFile() {
      const candidatePaths = ['/data/stops.xlsx', '/stops.xlsx'];
      try {
        for (const path of candidatePaths) {
          const response = await fetch(path);
          if (!response.ok) continue;
          const buffer = await response.arrayBuffer();
          const parsed = parseStopsWorkbook(buffer);
          setStops(parsed);
          setSourceLabel(`Loaded from ${path}`);
          return;
        }
        const jRes = await fetch('/data/stops.json');
        if (jRes.ok) {
          const rows = (await jRes.json()) as Array<{ stop_name: string; lat: number; lng: number }>;
          const pts: StopPoint[] = rows
            .filter((r) => r.stop_name && Number.isFinite(r.lat) && Number.isFinite(r.lng))
            .map((r) => ({ stop_name: r.stop_name.trim(), latitude: r.lat, longitude: r.lng }));
          setStops(pts);
          setSourceLabel('Loaded from /data/stops.json');
          return;
        }
        setSourceLabel('No stops file: add stops.xlsx or stops.json under /public/data/');
      } catch (error) {
        console.warn('[StopsMap] Load failed.', error);
        setSourceLabel('Failed to load stops');
      }
    }
    loadDefaultFile();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-4 p-4 lg:p-6">
        <PageHeader
          title="Stops Map"
          description="Approved suggestion stops are highlighted (amber pulse)."
          rightContent={<span className="text-xs text-muted-foreground">{sourceLabel}</span>}
        />

        <div className="glass-panel p-4">
          <p className="mt-3 text-xs text-muted-foreground">
            Total valid stops plotted: <span className="text-foreground">{stops.length}</span>
            {highlightedStopNames.size > 0 && (
              <>
                {' '}
                · <span className="text-neon-amber">Alert stops: {highlightedStopNames.size}</span>
              </>
            )}
          </p>
        </div>

        <MapComponent stops={stops} highlightedStopNames={highlightedStopNames} />
      </div>
    </AppLayout>
  );
}
