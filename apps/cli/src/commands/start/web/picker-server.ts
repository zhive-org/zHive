import { Hono } from 'hono';
import {
  addApiGuard,
  addDashboardStatic,
  buildBaseUrl,
  defaultDashboardRoot,
  listenLocalhost,
} from './web-shared';

export interface PickerAgentSummary {
  name: string;
  /** ISO 8601 timestamp. */
  created: string;
  bio: string | null;
  avatarUrl?: string;
}

export interface BuildPickerAppOptions {
  agents: PickerAgentSummary[];
  /** Called with the chosen agent name. Errors here are surfaced as 400s. */
  onSelect: (name: string) => void;
  dashboardRoot?: string | null;
  authToken?: string | null;
}

export interface StartPickerServerOptions extends BuildPickerAppOptions {
  port: number;
}

export interface PickerServerHandle {
  port: number;
  url: string;
  stop: () => Promise<void>;
  /** Resolves with the selected agent name. Rejects if `cancel()` is called. */
  waitForSelection: () => Promise<string>;
  cancel: (reason?: Error) => void;
}

export function buildPickerApp(options: BuildPickerAppOptions): Hono {
  const app = new Hono();
  const { agents, onSelect, authToken } = options;
  const validNames = new Set(agents.map((a) => a.name));
  const dashboardRoot =
    options.dashboardRoot === null ? null : (options.dashboardRoot ?? defaultDashboardRoot());

  app.get('/healthz', (c) => c.json({ ok: true }));

  addApiGuard(app, authToken);

  app.get('/api/state', (c) =>
    c.json({
      phase: 'selecting' as const,
      agents,
    }),
  );

  app.post('/api/agents/select', async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return c.json({ ok: false, error: 'Missing or invalid "name"' }, 400);
    }
    if (!validNames.has(name)) {
      return c.json({ ok: false, error: `Unknown agent: ${name}` }, 400);
    }
    onSelect(name);
    return c.json({ ok: true });
  });

  // Stub the runtime endpoints with 503 so the SPA degrades gracefully if it
  // somehow hits them while still in selecting mode.
  app.get('/api/events', (c) => c.json({ ok: false, error: 'agent not selected' }, 503));
  app.post('/api/command', (c) => c.json({ ok: false, error: 'agent not selected' }, 503));
  app.post('/api/chat', (c) => c.json({ ok: false, error: 'agent not selected' }, 503));

  addDashboardStatic(app, dashboardRoot, authToken);

  return app;
}

export async function startPickerServer(
  options: StartPickerServerOptions,
): Promise<PickerServerHandle> {
  let resolveSelection: ((name: string) => void) | null = null;
  let rejectSelection: ((err: Error) => void) | null = null;
  const selectionPromise = new Promise<string>((resolve, reject) => {
    resolveSelection = resolve;
    rejectSelection = reject;
  });

  const app = buildPickerApp({
    ...options,
    onSelect: (name) => {
      resolveSelection?.(name);
      // Block double-fire so a noisy client can't reset the promise.
      resolveSelection = null;
      rejectSelection = null;
      // Forward to the caller's onSelect too (no-op by default).
      options.onSelect?.(name);
    },
  });

  const handle = await listenLocalhost({ port: options.port, app });

  return {
    port: handle.port,
    url: buildBaseUrl(handle.port, options.authToken),
    stop: handle.stop,
    waitForSelection: () => selectionPromise,
    cancel: (reason?: Error) => {
      rejectSelection?.(reason ?? new Error('picker cancelled'));
      resolveSelection = null;
      rejectSelection = null;
    },
  };
}
