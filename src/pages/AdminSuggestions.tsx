import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import {
  fetchSuggestions,
  patchSuggestionStatus,
  isAdmin,
  type SuggestionRow,
} from '@/lib/suggestionsApi';

interface RouteRow {
  route_id: string;
  source: string;
  destination: string;
}

export default function AdminSuggestions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const admin = isAdmin();

  // Redirect non-admins immediately
  useEffect(() => {
    if (!admin) {
      navigate('/suggestions', { replace: true });
    }
  }, [admin, navigate]);

  const [routes, setRoutes] = useState<RouteRow[]>([]);
  useEffect(() => {
    fetch('/data/routes.json')
      .then((r) => r.json())
      .then((data: RouteRow[]) => setRoutes(data))
      .catch(() => { });
  }, []);

  const routeById = useMemo(() => {
    const map = new Map<string, RouteRow>();
    routes.forEach(r => map.set(r.route_id, r));
    return map;
  }, [routes]);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: fetchSuggestions,
    refetchInterval: 5000,
    enabled: admin,
  });

  const sorted = useMemo(
    () =>
      [...suggestions].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [suggestions]
  );

  const handleStatus = useCallback(
    async (id: string, status: 'approved' | 'rejected') => {
      try {
        await patchSuggestionStatus(id, status);
        toast.success(status === 'approved' ? 'Suggestion approved.' : 'Suggestion rejected.');
        await queryClient.invalidateQueries({ queryKey: ['suggestions'] });
        await queryClient.invalidateQueries({ queryKey: ['approved-alerts'] });
      } catch {
        toast.error('Update failed.');
      }
    },
    [queryClient]
  );

  if (!admin) return null;

  const pending = sorted.filter((s) => s.status === 'pending').length;
  const approved = sorted.filter((s) => s.status === 'approved').length;

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="text-primary" size={20} />
              <h1 className="font-display font-bold text-lg tracking-wider">User Suggestions Panel</h1>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Admin review · auto-refreshes every 5s
            </p>
          </div>
          <div className="flex gap-3 text-xs font-mono">
            <span className="px-2 py-1 rounded bg-neon-amber/10 text-neon-amber border border-neon-amber/20">
              {pending} pending
            </span>
            <span className="px-2 py-1 rounded bg-neon-green/10 text-neon-green border border-neon-green/20">
              {approved} approved
            </span>
          </div>
        </div>

        {/* Suggestions Table */}
        <div className="glass-panel p-4">
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider mb-3">
            All Suggestions
          </h2>

          {isLoading ? (
            <p className="text-xs text-muted-foreground font-mono">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono">No suggestions yet.</p>
          ) : (
            <div className="overflow-auto max-h-[560px] border border-border rounded-md">
              <table className="w-full text-xs font-mono">
                <thead className="bg-secondary/50 sticky top-0 z-10">
                  <tr className="text-left text-muted-foreground uppercase tracking-wider">
                    <th className="p-2 whitespace-nowrap">ID</th>
                    <th className="p-2 whitespace-nowrap">Route</th>
                    <th className="p-2 whitespace-nowrap">Stop</th>
                    <th className="p-2 whitespace-nowrap">Type</th>
                    <th className="p-2 whitespace-nowrap">Message</th>
                    <th className="p-2 whitespace-nowrap">Time</th>
                    <th className="p-2 whitespace-nowrap">Status</th>
                    <th className="p-2 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s: SuggestionRow) => (
                    <tr key={s.id} className="border-t border-border/60 hover:bg-secondary/20 transition-colors">
                      <td className="p-2 text-primary font-semibold">{s.id}</td>
                      <td className="p-2 whitespace-nowrap">
                        {s.route_id ? (
                          <div className="flex flex-col">
                            <span className="text-primary/80 font-semibold">{s.route_id}</span>
                            {routeById.get(s.route_id) && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={`${routeById.get(s.route_id)!.source} → ${routeById.get(s.route_id)!.destination}`}>
                                {routeById.get(s.route_id)!.source} → {routeById.get(s.route_id)!.destination}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2 max-w-[140px] truncate" title={s.stop_name}>
                        {s.stop_name || '—'}
                      </td>
                      <td className="p-2 capitalize">{s.issue_type}</td>
                      <td className="p-2 max-w-[220px] truncate" title={s.message}>
                        {s.message}
                      </td>
                      <td className="p-2 text-muted-foreground whitespace-nowrap">
                        {new Date(s.timestamp).toLocaleString()}
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold tracking-wider ${s.status === 'approved'
                              ? 'bg-neon-green/10 text-neon-green'
                              : s.status === 'rejected'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-neon-amber/10 text-neon-amber'
                            }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {s.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              className="text-neon-green mr-3 hover:underline font-medium"
                              onClick={() => handleStatus(s.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="text-destructive hover:underline font-medium"
                              onClick={() => handleStatus(s.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground font-mono">
          Only <span className="text-neon-green">approved</span> suggestions trigger alerts on the Command Center and Stops Map.
        </p>
      </div>
    </AppLayout>
  );
}
