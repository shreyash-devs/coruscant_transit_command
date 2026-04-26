import { detectStopFromMessage } from './detectStopInMessage';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface SuggestionRow {
  id: string;
  route_id?: string;
  stop_name: string;
  issue_type: string;
  message: string;
  user_id: string;
  timestamp: string;
  status: SuggestionStatus;
  reviewed_at?: string;
}

const LS_SUGGESTIONS = 'ctc_suggestions_json';
const LS_STOPS_CACHE = 'ctc_stop_names_cache';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadStopNames(): Promise<string[]> {
  const cached = sessionStorage.getItem(LS_STOPS_CACHE);
  if (cached) {
    try {
      return JSON.parse(cached) as string[];
    } catch {
      /* fall through */
    }
  }
  const res = await fetch('/data/stops.json');
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{ stop_name: string }>;
  const names = rows.map((r) => r.stop_name).filter(Boolean);
  try {
    sessionStorage.setItem(LS_STOPS_CACHE, JSON.stringify(names));
  } catch {
    /* ignore */
  }
  return names;
}

/**
 * localStorage is the SINGLE SOURCE OF TRUTH for all suggestion state.
 * It is shared across every tab/window at the same origin, so a user tab
 * and an admin tab always share the same list without needing the API.
 * The API (Vite dev plugin) is used only as a write-through side-effect
 * to keep suggestions.json on disk in sync.
 */
async function readLocalSuggestions(): Promise<SuggestionRow[]> {
  const raw = localStorage.getItem(LS_SUGGESTIONS);
  if (raw) {
    try {
      return JSON.parse(raw) as SuggestionRow[];
    } catch {
      /* fall through — corrupt data, re-seed */
    }
  }
  // First ever visit: seed from the static file
  try {
    const res = await fetch('/data/suggestions.json');
    if (res.ok) {
      const seed = (await res.json()) as SuggestionRow[];
      localStorage.setItem(LS_SUGGESTIONS, JSON.stringify(seed));
      return seed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function writeLocalSuggestions(rows: SuggestionRow[]): void {
  localStorage.setItem(LS_SUGGESTIONS, JSON.stringify(rows));
}

function nextId(rows: SuggestionRow[]): string {
  let max = 0;
  for (const r of rows) {
    const m = /^SG_(\d+)$/.exec(r.id);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return `SG_${String(max + 1).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch ALL suggestions.
 * Reads from localStorage (shared across all tabs — always consistent).
 * Also attempts a background sync with the API so that any suggestions
 * written on-disk (e.g. by a different browser session) are pulled in.
 */
export async function fetchSuggestions(): Promise<SuggestionRow[]> {
  const local = await readLocalSuggestions();

  // Background sync: pull from API and merge (API wins for status updates)
  try {
    const r = await fetch('/api/suggestions');
    if (r.ok) {
      const apiRows = (await r.json()) as SuggestionRow[];
      if (apiRows.length > 0) {
        // Merge: keep all local rows, overwrite matching rows with API version
        const apiById = new Map(apiRows.map((r) => [r.id, r]));
        const localById = new Map(local.map((r) => [r.id, r]));
        // Union of both sets; API row wins if same id
        const merged: SuggestionRow[] = [];
        const seen = new Set<string>();
        for (const row of [...local, ...apiRows]) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            // Prefer API version if both exist (captures server-side status)
            merged.push(apiById.get(row.id) ?? localById.get(row.id) ?? row);
          }
        }
        writeLocalSuggestions(merged);
        return merged;
      }
    }
  } catch {
    /* network/API unavailable — use localStorage, which is always up-to-date */
  }

  return local;
}

export async function fetchApprovedSuggestions(): Promise<SuggestionRow[]> {
  const all = await fetchSuggestions();
  return all.filter((s) => s.status === 'approved');
}

/**
 * Create a new suggestion.
 * Writes to localStorage IMMEDIATELY (so admin sees it right away),
 * then fires an API POST as a best-effort side-effect to sync to disk.
 */
export async function createSuggestion(input: {
  issue_type: string;
  message: string;
  user_id: string;
  route_id?: string;
  stop_name_hint?: string; // source stop from selected route
}): Promise<SuggestionRow> {
  const message = input.message.trim();
  const issue_type = ['overcrowded', 'delay', 'traffic', 'weather'].includes(input.issue_type)
    ? input.issue_type
    : 'overcrowded';

  // If a route was selected, use its source as the stop name directly.
  // Otherwise fall back to fuzzy detection from the message text.
  let stop_name: string;
  if (input.stop_name_hint && input.stop_name_hint.trim()) {
    stop_name = input.stop_name_hint.trim();
  } else {
    const names = await loadStopNames();
    stop_name = detectStopFromMessage(message, names);
    if (stop_name === 'Unknown') {
      console.warn('[SuggestionsApi] No stop matched in message:', message);
    }
  }

  // Write to localStorage immediately — visible to all tabs instantly
  const list = await readLocalSuggestions();
  const row: SuggestionRow = {
    id: nextId(list),
    route_id: input.route_id,
    stop_name,
    issue_type,
    message,
    user_id: input.user_id,
    timestamp: new Date().toISOString(),
    status: 'pending',
  };
  list.push(row);
  writeLocalSuggestions(list);

  // Best-effort: also persist to suggestions.json via Vite dev API
  try {
    await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issue_type,
        message,
        user_id: input.user_id,
        route_id: input.route_id,
        stop_name,
      }),
    });
  } catch {
    /* ignore — data is already safe in localStorage */
  }

  return row;
}

/**
 * Update suggestion status to approved or rejected.
 * Writes to localStorage IMMEDIATELY, then syncs to disk via API.
 */
export async function patchSuggestionStatus(
  id: string,
  status: 'approved' | 'rejected'
): Promise<SuggestionRow | null> {
  // Update localStorage immediately
  const list = await readLocalSuggestions();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return null;

  list[idx] = {
    ...list[idx],
    status,
    reviewed_at: new Date().toISOString(),
  };
  writeLocalSuggestions(list);
  const updated = list[idx];

  // Best-effort: sync to disk via API
  try {
    await fetch(`/api/suggestions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  } catch {
    /* ignore — already updated in localStorage */
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export function getSessionUserId(): string {
  return sessionStorage.getItem('ctc_user_id') ?? 'USR_001';
}

export function getSessionRole(): string {
  return sessionStorage.getItem('ctc_role') ?? 'user';
}

export function isAdmin(): boolean {
  return getSessionRole() === 'admin';
}

// ---------------------------------------------------------------------------
// Alert formatters
// ---------------------------------------------------------------------------

export function formatSuggestionAlert(s: SuggestionRow): string {
  // New suggestions have comprehensive messages built-in
  if (s.message && s.message.includes('route')) {
    return `⚠️ ${s.message}`;
  }

  // Fallback for older suggestions
  const stop = s.stop_name || 'Unknown stop';
  switch (s.issue_type) {
    case 'overcrowded':
      return `⚠️ Heavy crowd at ${stop}`;
    case 'delay':
      return `⚠️ Delay reported at ${stop}`;
    case 'traffic':
      return `⚠️ Traffic issue at ${stop}`;
    case 'weather':
      return `⚠️ Weather impact at ${stop}`;
    default:
      return `⚠️ Alert at ${stop}`;
  }
}

export function formatApprovedAlert(s: SuggestionRow): string {
  return formatSuggestionAlert(s);
}
