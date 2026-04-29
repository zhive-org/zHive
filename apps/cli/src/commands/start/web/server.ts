import { Hono } from 'hono';
import { serve, type ServerType } from '@hono/node-server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WebEventBus } from './events';
import type { WebControl } from './control';

export const DEFAULT_WEB_PORT = 7878;
const HOST = '127.0.0.1';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function defaultDashboardRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dashboard');
}

export interface BuildAppOptions {
  eventBus?: WebEventBus;
  control?: WebControl;
  /** Absolute path to the built dashboard directory (default: `<binary dir>/dashboard`). Pass `null` to disable static serving. */
  dashboardRoot?: string | null;
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
  const dashboardRoot =
    options.dashboardRoot === null ? null : (options.dashboardRoot ?? defaultDashboardRoot());

  app.get('/healthz', (c) => c.json({ ok: true }));

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

  if (dashboardRoot) {
    app.get('/*', async (c) => {
      const reqPath = c.req.path;
      if (reqPath.startsWith('/api/') || reqPath === '/healthz') {
        return c.notFound();
      }
      const relPath = reqPath === '/' ? 'index.html' : reqPath.slice(1);
      const target = path.resolve(dashboardRoot, relPath);
      // Path-traversal guard: resolved target must stay inside dashboardRoot.
      if (target !== dashboardRoot && !target.startsWith(dashboardRoot + path.sep)) {
        return c.notFound();
      }
      try {
        const fileStat = await stat(target);
        if (!fileStat.isFile()) return c.notFound();
        const content = await readFile(target);
        const ext = path.extname(target).toLowerCase();
        const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';
        return c.body(new Uint8Array(content), 200, { 'content-type': mimeType });
      } catch {
        if (reqPath === '/') {
          return c.text(
            'zHive dashboard bundle not found. Build it with `pnpm --filter @zhive/cli build`.',
            503,
            { 'content-type': 'text/plain; charset=utf-8' },
          );
        }
        return c.notFound();
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
