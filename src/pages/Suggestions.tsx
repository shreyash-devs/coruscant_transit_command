import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, ChevronDown, X, Route } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { createSuggestion, getSessionUserId, isAdmin } from '@/lib/suggestionsApi';

interface RouteRow {
  route_id: string;
  source: string;
  destination: string;
}

const ISSUE_TYPES = [
  { value: 'overcrowded', label: 'Overcrowded' },
  { value: 'delay', label: 'Delay' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'weather', label: 'Weather' },
];

// ---------------------------------------------------------------------------
// Searchable Route Dropdown
// ---------------------------------------------------------------------------
interface RouteDropdownProps {
  routes: RouteRow[];
  value: RouteRow | null;
  onChange: (r: RouteRow | null) => void;
}

function RouteDropdown({ routes, value, onChange }: RouteDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return routes.slice(0, 80); // show first 80 when no search
    return routes.filter(
      (r) =>
        r.route_id.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q)
    );
  }, [search, routes]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSelect(r: RouteRow) {
    onChange(r);
    setOpen(false);
    setSearch('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        id="route-dropdown-trigger"
        onClick={handleOpen}
        className={`w-full flex items-center justify-between gap-2 bg-secondary/50 border rounded-md px-3 py-2.5 text-sm font-mono text-left transition-colors ${
          open ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/40'
        }`}
      >
        {value ? (
          <span className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-primary font-semibold shrink-0">{value.route_id}</span>
            <span className="text-muted-foreground truncate">
              {value.source} → {value.destination}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground/60">Select a route…</span>
        )}
        <span className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={15}
            className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-xl overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search route ID, source or destination…"
              className="flex-1 bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Route list */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground font-mono text-center">
                No routes match "{search}"
              </li>
            ) : (
              filtered.map((r) => (
                <li key={r.route_id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(r)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary/60 transition-colors ${
                      value?.route_id === r.route_id ? 'bg-primary/10' : ''
                    }`}
                  >
                    <span className="text-primary font-mono text-xs font-semibold w-16 shrink-0">
                      {r.route_id}
                    </span>
                    <span className="text-xs font-mono text-foreground truncate">
                      {r.source}
                      <span className="text-muted-foreground mx-1">→</span>
                      {r.destination}
                    </span>
                  </button>
                </li>
              ))
            )}
            {!search && routes.length > 80 && (
              <li className="px-3 py-2 text-[10px] text-muted-foreground font-mono text-center border-t border-border/50">
                Showing 80 of {routes.length} routes. Type to search all.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Suggestions Page
// ---------------------------------------------------------------------------
export default function Suggestions() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const admin = isAdmin();

  const [issueType, setIssueType] = useState('overcrowded');
  const [selectedRoute, setSelectedRoute] = useState<RouteRow | null>(null);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load routes once
  useEffect(() => {
    fetch('/data/routes.json')
      .then((r) => r.json())
      .then((data: RouteRow[]) => setRoutes(data))
      .catch(() => toast.error('Could not load routes.'))
      .finally(() => setLoadingRoutes(false));
  }, []);

  // ── Admin redirect view ──────────────────────────────────────────────────
  if (admin) {
    return (
      <AppLayout>
        <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
          <div>
            <h1 className="font-display font-bold text-lg tracking-wider">Suggestions</h1>
            <p className="text-xs text-muted-foreground font-mono">Crowd &amp; operations feedback</p>
          </div>
          <div className="glass-panel p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground font-mono">
              As an admin, manage suggestions from the dedicated panel.
            </p>
            <button
              onClick={() => navigate('/admin/suggestions')}
              className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-all neon-glow"
            >
              Open User Suggestions Panel →
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute) {
      toast.error('Please select a route.');
      return;
    }
    setSubmitting(true);
    try {
      const row = await createSuggestion({
        issue_type: issueType,
        // Message is auto-built from selected route so stop detection is deterministic
        message: `${issueType} issue reported on route ${selectedRoute.route_id}: ${selectedRoute.source} → ${selectedRoute.destination}`,
        user_id: getSessionUserId(),
        route_id: selectedRoute.route_id,
        stop_name_hint: selectedRoute.source, // source stop as the primary stop
      });
      toast.success(`Submitted ${row.id} — Route ${selectedRoute.route_id} · Stop: ${row.stop_name}`);
      setSelectedRoute(null);
      await queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    } catch {
      toast.error('Could not submit suggestion.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── User form view ───────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="font-display font-bold text-lg tracking-wider">Suggestions</h1>
          <p className="text-xs text-muted-foreground font-mono">Crowd &amp; operations feedback</p>
        </div>

        <div className="glass-panel p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Route size={16} className="text-primary" />
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider">Submit suggestion</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Issue type */}
            <div>
              <label htmlFor="issue-type-select" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">
                Issue type
              </label>
              <select
                id="issue-type-select"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              >
                {ISSUE_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Route searchable dropdown */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">
                Route (required)
              </label>
              {loadingRoutes ? (
                <div className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 text-sm text-muted-foreground font-mono animate-pulse">
                  Loading routes…
                </div>
              ) : (
                <RouteDropdown
                  routes={routes}
                  value={selectedRoute}
                  onChange={setSelectedRoute}
                />
              )}
              <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                Search by route ID, source or destination. The route source stop is auto-assigned.
              </p>
            </div>

            {/* Selected route preview */}
            {selectedRoute && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs font-mono space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Route</span>
                  <span className="text-primary font-semibold">{selectedRoute.route_id}</span>
                </div>
                <div className="text-foreground">
                  {selectedRoute.source}
                  <span className="text-muted-foreground mx-1.5">→</span>
                  {selectedRoute.destination}
                </div>
                <div className="text-muted-foreground text-[10px]">
                  Stop assigned: <span className="text-foreground">{selectedRoute.source}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !selectedRoute}
              className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all neon-glow"
            >
              {submitting ? 'Submitting…' : 'Submit Suggestion'}
            </button>
          </form>
        </div>

        <p className="text-[10px] text-muted-foreground font-mono">
          Your suggestion will be reviewed by an admin. Only approved suggestions affect the system.
        </p>
      </div>
    </AppLayout>
  );
}
