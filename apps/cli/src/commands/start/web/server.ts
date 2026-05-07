import { Hono, type Context } from 'hono';
import { serve, type ServerType } from '@hono/node-server';
import { getCookie, setCookie } from 'hono/cookie';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WebEventBus } from './events';
import type { WebControl } from './control';
import { SLASH_COMMANDS } from '../services/command-registry';

export const DEFAULT_WEB_PORT = 7878;
const HOST = '127.0.0.1';
const AUTH_COOKIE = 'zhive_auth';
const MAX_CHAT_BYTES = 8 * 1024;

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

function isLocalHost(c: Context): boolean {
  // Real browsers always send Host. Fall back to the request URL's hostname
  // for environments that don't synthesize it (unit tests via app.fetch).
  let hostname: string | undefined;
  const header = c.req.header('host');
  if (header) {
    hostname = header.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  } else {
    try {
      hostname = new URL(c.req.url).hostname;
    } catch {
      hostname = undefined;
    }
  }
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

function isAuthorized(c: Context, authToken: string | null | undefined): boolean {
  if (!authToken) return true;
  const cookie = getCookie(c, AUTH_COOKIE);
  if (cookie === authToken) return true;
  const header = c.req.header('authorization');
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (match && match[1] === authToken) return true;
  }
  return false;
}

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

  // Defense-in-depth against DNS rebinding: reject anything that doesn't look
  // like a request to localhost. Static assets are exempt — they carry no
  // secrets and fetching them through a rebound DNS entry is harmless.
  app.use('/api/*', async (c, next) => {
    if (!isLocalHost(c)) {
      return c.json({ ok: false, error: 'forbidden host' }, 403);
    }
    if (!isAuthorized(c, authToken)) {
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    await next();
  });

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

      // Auth flow for the HTML entry: a fresh ?token=… sets the session cookie
      // and redirects to a clean URL. Static assets under /assets are public.
      if (reqPath === '/' && authToken) {
        const queryToken = c.req.query('token');
        if (queryToken === authToken) {
          setCookie(c, AUTH_COOKIE, authToken, {
            httpOnly: true,
            sameSite: 'Lax',
            path: '/',
          });
          return c.redirect('/', 302);
        }
        if (!isAuthorized(c, authToken)) {
          return c.text(
            'zHive dashboard: open the URL printed by `cli start --web` (it includes the auth token).',
            401,
            { 'content-type': 'text/plain; charset=utf-8' },
          );
        }
      }

      const relPath = reqPath === '/' ? 'index.html' : reqPath.slice(1);
      const initialTarget = path.resolve(dashboardRoot, relPath);
      // Path-traversal guard: the resolved target must stay inside dashboardRoot.
      // We check both the resolved path AND its realpath so a symlink inside
      // the bundle directory can't escape to elsewhere on disk.
      if (initialTarget !== dashboardRoot && !initialTarget.startsWith(dashboardRoot + path.sep)) {
        return c.notFound();
      }
      let target = initialTarget;
      try {
        // Resolve the root too so prefix comparison works on platforms where
        // tmpdir() returns a symlink (e.g. /var/folders → /private/var/folders
        // on macOS).
        const realRoot = await realpath(dashboardRoot);
        const real = await realpath(initialTarget);
        if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
          return c.notFound();
        }
        target = real;
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
      try {
        const fileStat = await stat(target);
        if (!fileStat.isFile()) return c.notFound();
        const content = await readFile(target);
        const ext = path.extname(target).toLowerCase();
        const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';
        // index.html must always be revalidated (the asset filenames in it
        // change between builds). /assets/* are content-hashed, immutable.
        const cacheControl = reqPath.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache';
        return c.body(content, 200, {
          'content-type': mimeType,
          'cache-control': cacheControl,
        });
      } catch {
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

  const baseUrl = `http://${HOST}:${options.port}`;
  const url = options.authToken ? `${baseUrl}/?token=${options.authToken}` : baseUrl;

  return {
    port: options.port,
    url,
    stop,
  };
}
