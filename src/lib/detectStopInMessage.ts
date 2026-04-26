import Fuse from 'fuse.js';

const PHRASES = ['railway station', 'bus stop', 'bus stand'] as const;
const TOKENS = [
  'stand',
  'depot',
  'station',
  'terminal',
  'gate',
  'circle',
  'phata',
  'stop',
  'junction',
  'chowk',
  'nagar',
  'road',
  'signal',
  'via',
] as const;

function normalizeForMatch(value: string): string {
  let s = String(value || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  for (const phrase of PHRASES) {
    const re = new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    s = s.replace(re, ' ');
  }
  for (const t of TOKENS) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Finds the best-matching master stop name inside free-form user text.
 */
export function detectStopFromMessage(message: string, stopNames: string[]): string {
  const trimmed = message?.trim();
  if (!trimmed || stopNames.length === 0) return 'Unknown';

  const msgNorm = normalizeForMatch(trimmed);
  const lower = trimmed.toLowerCase();

  let bestName: string | null = null;
  let bestLen = 0;
  for (const name of stopNames) {
    const n = name.trim();
    if (!n) continue;
    const key = normalizeForMatch(n);
    if (key.length < 3) continue;
    if (msgNorm.includes(key) || lower.includes(n.toLowerCase())) {
      if (n.length > bestLen) {
        bestLen = n.length;
        bestName = n;
      }
    }
  }
  if (bestName) return bestName;

  const fuse = new Fuse(stopNames, {
    includeScore: true,
    threshold: 0.42,
    ignoreLocation: true,
    minMatchCharLength: 3,
  });
  const hits = fuse.search(trimmed, { limit: 1 });
  const h = hits[0];
  if (h?.score !== undefined && h.score < 0.38 && typeof h.item === 'string') {
    return h.item;
  }

  return 'Unknown';
}
