import { Hono } from 'hono';
import type { WebEventBus } from './events';
import type { WebControl } from './control';
import { SLASH_COMMANDS } from '../services/command-registry';
import {
  addApiGuard,
  addDashboardStatic,
  buildBaseUrl,
  defaultDashboardRoot,
  listenLocalhost,
} from './web-shared';

export const DEFAULT_WEB_PORT = 7878;
const MAX_CHAT_BYTES = 8 * 1024;

function pushError(eventBus: WebEventBus | undefined, errorMessage: string): void {
  eventBus?.push({ type: 'error', errorMessage });
}

export interface BuildAppOptions {
  eventBus?: WebEventBus;
  control?: WebControl;
  /** Absolute path to the built dashboard directory (default: `<binary dir>/dashboard`). Pass `null` to disable static serving. */
  dashboardRoot?: string | null;
  /** Shared secret required for `/api/*` and dashboard load. Pass `null` to disable auth (tests / dev). */
  authToken?: string | null;
}

export interface StartWebServerOptions extends BuildAppOptions {
  port: number;
}

export interface WebServerHandle {
  port: number;
  url: string;
  stop: () => Promise<void>;
}

export function buildApp(options: BuildAppOptions): Hono {
  const app = new Hono();
  const { eventBus, control, authToken } = options;
  const dashboardRoot =
    options.dashboardRoot === null ? null : (options.dashboardRoot ?? defaultDashboardRoot());

  app.get('/healthz', (c) => c.json({ ok: true }));

  addApiGuard(app, authToken);

  if (eventBus) {
    app.get('/api/events', (c) => {
      const sinceParam = c.req.query('since');
      const parsed = sinceParam !== undefined ? Number.parseInt(sinceParam, 10) : 0;
      const since = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      return c.json(eventBus.since(since));
    });
  }

  if (control) {
    const slashNames = new Set(SLASH_COMMANDS.map((cmd) => cmd.name));

    app.post('/api/command', async (c) => {
      const body = await c.req.json().catch(() => null);
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return c.json({ ok: false, error: 'Missing or invalid "name"' }, 400);
      }
      if (!slashNames.has(name)) {
        return c.json({ ok: false, error: `Unknown command: ${name}` }, 400);
      }
      // Fire-and-forget so streaming output flows back via the event bus, not
      // the response body. Catch rejections so we don't trip unhandledRejection
      // and so the dashboard sees the failure.
      control.executeCommand(name).catch((err) => {
        pushError(eventBus, err instanceof Error ? err.message : String(err));
      });
      return c.json({ ok: true });
    });

    app.post('/api/chat', async (c) => {
      const body = await c.req.json().catch(() => null);
      const text = typeof body?.text === 'string' ? body.text : '';
      if (!text.trim()) {
        return c.json({ ok: false, error: 'Missing or invalid "text"' }, 400);
      }
      if (text.length > MAX_CHAT_BYTES) {
        return c.json({ ok: false, error: `"text" exceeds ${MAX_CHAT_BYTES} bytes` }, 413);
      }
      control.submitChat(text).catch((err) => {
        pushError(eventBus, err instanceof Error ? err.message : String(err));
      });
      return c.json({ ok: true });
    });

    app.get('/api/state', async (c) => {
      try {
        const state = await control.getState();
        return c.json({ phase: 'ready', ...state });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({ ok: false, error: message }, 503);
      }
    });
  }

  addDashboardStatic(app, dashboardRoot, authToken);

  return app;
}

export async function startWebServer(options: StartWebServerOptions): Promise<WebServerHandle> {
  const app = buildApp(options);
  const handle = await listenLocalhost({ port: options.port, app });
  return {
    port: handle.port,
    url: buildBaseUrl(handle.port, options.authToken),
    stop: handle.stop,
  };
}
