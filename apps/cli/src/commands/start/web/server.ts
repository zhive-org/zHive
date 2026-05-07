import { Hono } from 'hono';
import { serve, type ServerType } from '@hono/node-server';
import type { WebEventBus } from './events';
import type { WebControl } from './control';

export const DEFAULT_WEB_PORT = 7878;
const HOST = '127.0.0.1';

export interface BuildAppOptions {
  eventBus?: WebEventBus;
  control?: WebControl;
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
  const { eventBus, control } = options;

  app.get('/healthz', (c) => c.json({ ok: true }));
  app.get('/', (c) =>
    c.text('zHive CLI dashboard — coming soon. Server is running on this port.', 200, {
      'content-type': 'text/plain; charset=utf-8',
    }),
  );

  if (eventBus) {
    app.get('/api/events', (c) => {
      const sinceParam = c.req.query('since');
      const parsed = sinceParam !== undefined ? Number.parseInt(sinceParam, 10) : 0;
      const since = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      return c.json(eventBus.since(since));
    });
  }

  if (control) {
    app.post('/api/command', async (c) => {
      const body = await c.req.json().catch(() => null);
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return c.json({ ok: false, error: 'Missing or invalid "name"' }, 400);
      }
      void control.executeCommand(name);
      return c.json({ ok: true });
    });

    app.post('/api/chat', async (c) => {
      const body = await c.req.json().catch(() => null);
      const text = typeof body?.text === 'string' ? body.text : '';
      if (!text.trim()) {
        return c.json({ ok: false, error: 'Missing or invalid "text"' }, 400);
      }
      void control.submitChat(text);
      return c.json({ ok: true });
    });

    app.get('/api/state', async (c) => {
      try {
        const state = await control.getState();
        return c.json(state);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({ ok: false, error: message }, 503);
      }
    });
  }

  return app;
}

export async function startWebServer(options: StartWebServerOptions): Promise<WebServerHandle> {
  const app = buildApp(options);

  const server = await new Promise<ServerType>((resolve, reject) => {
    let resolved = false;
    const handle = serve(
      {
        fetch: app.fetch,
        port: options.port,
        hostname: HOST,
      },
      () => {
        resolved = true;
        resolve(handle);
      },
    );

    // node http.Server emits 'error' on bind failures (EADDRINUSE, EACCES, …).
    // Surface them as a rejected promise so the caller can decide what to do.
    handle.on('error', (err: Error) => {
      if (!resolved) reject(err);
    });
  });

  const stop = (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  return {
    port: options.port,
    url: `http://${HOST}:${options.port}`,
    stop,
  };
}
