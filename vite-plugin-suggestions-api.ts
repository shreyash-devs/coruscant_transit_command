import fs from 'fs';
import path from 'path';
import type { Connect, Plugin } from 'vite';
import { detectStopFromMessage } from './src/lib/detectStopInMessage';

const DATA = (name: string) => path.join(process.cwd(), 'public', 'data', name);

function readJson<T>(file: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function nextSuggestionId(rows: { id: string }[]): string {
  let max = 0;
  for (const r of rows) {
    const m = /^SG_(\d+)$/.exec(r.id);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  const n = max + 1;
  return `SG_${String(n).padStart(3, '0')}`;
}

function parseBody(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
    });
    req.on('end', () => {
      try {
        resolve(data ? (JSON.parse(data) as Record<string, unknown>) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function suggestionsApiPlugin(): Plugin {
  return {
    name: 'ctc-suggestions-json-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/')) return next();

        const suggestionsFile = DATA('suggestions.json');
        const stopsFile = DATA('stops.json');

        const sendJson = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };

        try {
          if (url === '/api/suggestions' && req.method === 'GET') {
            const list = readJson<Array<Record<string, unknown>>>(suggestionsFile, []);
            sendJson(200, list);
            return;
          }

          if (url === '/api/suggestions' && req.method === 'POST') {
            const body = await parseBody(req);
            const issue_type = String(body.issue_type ?? '');
            const message = String(body.message ?? '').trim();
            const user_id = String(body.user_id ?? 'USR_001');
            if (!message) {
              sendJson(400, { error: 'message required' });
              return;
            }
            const route_id = body.route_id ? String(body.route_id) : undefined;
            const explicit_stop_name = body.stop_name ? String(body.stop_name) : undefined;
            
            let stop_name = explicit_stop_name;
            if (!stop_name) {
              const stops = readJson<Array<{ stop_name: string }>>(stopsFile, []);
              const names = stops.map((s) => s.stop_name).filter(Boolean);
              stop_name = detectStopFromMessage(message, names);
            }

            const list = readJson<Array<Record<string, unknown>>>(suggestionsFile, []);
            const id = nextSuggestionId(list as { id: string }[]);
            const row = {
              id,
              route_id,
              stop_name,
              issue_type: ['overcrowded', 'delay', 'traffic', 'weather'].includes(issue_type)
                ? issue_type
                : 'overcrowded',
              message,
              user_id,
              timestamp: new Date().toISOString(),
              status: 'pending',
            };
            list.push(row);
            writeJson(suggestionsFile, list);
            sendJson(201, row);
            return;
          }

          const patchMatch = /^\/api\/suggestions\/([^/?]+)$/.exec(url.split('?')[0]);
          if (patchMatch && req.method === 'PATCH') {
            const id = decodeURIComponent(patchMatch[1]);
            const body = await parseBody(req);
            const status = body.status === 'approved' || body.status === 'rejected' ? body.status : null;
            if (!status) {
              sendJson(400, { error: 'status must be approved or rejected' });
              return;
            }
            const list = readJson<Array<Record<string, unknown>>>(suggestionsFile, []);
            const idx = list.findIndex((r) => r.id === id);
            if (idx < 0) {
              sendJson(404, { error: 'not found' });
              return;
            }
            list[idx] = { ...list[idx], status, reviewed_at: new Date().toISOString() };
            writeJson(suggestionsFile, list);
            sendJson(200, list[idx]);
            return;
          }

          if (url === '/api/users' && req.method === 'GET') {
            const users = readJson(DATA('users.json'), []);
            sendJson(200, users);
            return;
          }
        } catch (e) {
          sendJson(500, { error: e instanceof Error ? e.message : 'server error' });
          return;
        }

        next();
      });
    },
  };
}
