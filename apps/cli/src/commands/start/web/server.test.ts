import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildApp } from './server';
import { WebEventBus } from './events';
import type { WebControl, WebState } from './control';

function fakeControl(overrides: Partial<WebControl> = {}): WebControl {
  return {
    executeCommand: vi.fn().mockResolvedValue(undefined),
    submitChat: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue({
      agentName: 'test',
      watchlist: ['BTC', 'ETH'],
      positions: [],
      memory: '',
    } satisfies WebState),
    ...overrides,
  };
}

async function fetch(app: ReturnType<typeof buildApp>, path: string, init?: RequestInit) {
  return app.fetch(new Request(`http://localhost${path}`, init));
}

describe('buildApp', () => {
  it('serves /healthz regardless of options', async () => {
    const app = buildApp({ dashboardRoot: null });
    const res = await fetch(app, '/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('omits /api routes when neither bus nor control supplied', async () => {
    const app = buildApp({ dashboardRoot: null });
    const events = await fetch(app, '/api/events');
    expect(events.status).toBe(404);
    const state = await fetch(app, '/api/state');
    expect(state.status).toBe(404);
  });

  describe('with eventBus', () => {
    it('returns events since seq with latest and oldestSeq', async () => {
      const bus = new WebEventBus();
      bus.push({ type: 'message', text: 'a' });
      bus.push({ type: 'message', text: 'b' });
      const app = buildApp({ eventBus: bus, dashboardRoot: null });

      const res = await fetch(app, '/api/events?since=1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.events.map((e: { seq: number }) => e.seq)).toEqual([2]);
      expect(body.latest).toBe(2);
      expect(body.oldestSeq).toBe(1);
    });
  });

  describe('with control', () => {
    it('POST /api/command dispatches and returns ok', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '/skills' }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(control.executeCommand).toHaveBeenCalledWith('/skills');
    });

    it('POST /api/command rejects missing name', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      expect(control.executeCommand).not.toHaveBeenCalled();
    });

    it('POST /api/chat dispatches and returns ok', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'hello' }),
      });
      expect(res.status).toBe(200);
      expect(control.submitChat).toHaveBeenCalledWith('hello');
    });

    it('POST /api/chat rejects empty text', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: '   ' }),
      });
      expect(res.status).toBe(400);
      expect(control.submitChat).not.toHaveBeenCalled();
    });

    it('GET /api/state returns the snapshot', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/state');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.agentName).toBe('test');
      expect(body.watchlist).toEqual(['BTC', 'ETH']);
    });

    it('GET /api/state returns 503 when getState throws', async () => {
      const control = fakeControl({
        getState: vi.fn().mockRejectedValue(new Error('not ready')),
      });
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/state');
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe('not ready');
    });
  });

  describe('dashboard static serving', () => {
    let tmp: string;

    beforeAll(async () => {
      tmp = await mkdtemp(path.join(tmpdir(), 'zhive-dashboard-test-'));
      await mkdir(path.join(tmp, 'assets'), { recursive: true });
      await writeFile(path.join(tmp, 'index.html'), '<!doctype html><body>hi</body>');
      await writeFile(path.join(tmp, 'assets', 'index-abc.js'), 'console.log(1)');
    });

    afterAll(async () => {
      await rm(tmp, { recursive: true, force: true });
    });

    it('serves index.html at /', async () => {
      const app = buildApp({ dashboardRoot: tmp });
      const res = await fetch(app, '/');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toContain('hi');
    });

    it('serves nested static assets with the correct mime', async () => {
      const app = buildApp({ dashboardRoot: tmp });
      const res = await fetch(app, '/assets/index-abc.js');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/javascript');
      expect(await res.text()).toBe('console.log(1)');
    });

    it('returns 404 for missing files', async () => {
      const app = buildApp({ dashboardRoot: tmp });
      const res = await fetch(app, '/missing.txt');
      expect(res.status).toBe(404);
    });

    it('returns a friendly 503 for / when index.html is missing', async () => {
      const empty = await mkdtemp(path.join(tmpdir(), 'zhive-empty-'));
      try {
        const app = buildApp({ dashboardRoot: empty });
        const res = await fetch(app, '/');
        expect(res.status).toBe(503);
        expect(await res.text()).toContain('not found');
      } finally {
        await rm(empty, { recursive: true, force: true });
      }
    });

    it('does not intercept /api/* even when those routes are unmounted', async () => {
      const app = buildApp({ dashboardRoot: tmp });
      const res = await fetch(app, '/api/state');
      expect(res.status).toBe(404);
    });

    it('blocks path traversal', async () => {
      const app = buildApp({ dashboardRoot: tmp });
      const res = await fetch(app, '/../package.json');
      expect(res.status).toBe(404);
    });

    it('blocks encoded path traversal', async () => {
      const app = buildApp({ dashboardRoot: tmp });
      const res = await fetch(app, '/%2e%2e/package.json');
      expect(res.status).toBe(404);
    });

    it('sets immutable cache for /assets/*', async () => {
      const app = buildApp({ dashboardRoot: tmp });
      const res = await fetch(app, '/assets/index-abc.js');
      expect(res.headers.get('cache-control')).toContain('immutable');
    });

    it('sets no-cache for index.html', async () => {
      const app = buildApp({ dashboardRoot: tmp });
      const res = await fetch(app, '/');
      expect(res.headers.get('cache-control')).toBe('no-cache');
    });
  });

  describe('auth', () => {
    const TOKEN = 'secret-test-token';

    it('blocks /api/* requests without a token', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null, authToken: TOKEN });
      const res = await fetch(app, '/api/state');
      expect(res.status).toBe(401);
      expect(control.getState).not.toHaveBeenCalled();
    });

    it('accepts /api/* with a valid bearer token', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null, authToken: TOKEN });
      const res = await fetch(app, '/api/state', {
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      expect(res.status).toBe(200);
    });

    it('rejects /api/* with the wrong bearer token', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null, authToken: TOKEN });
      const res = await fetch(app, '/api/state', {
        headers: { authorization: 'Bearer wrong' },
      });
      expect(res.status).toBe(401);
    });

    it('rejects requests with a non-localhost Host header', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null, authToken: TOKEN });
      const res = await app.fetch(
        new Request('http://attacker.example.com/api/state', {
          headers: { authorization: `Bearer ${TOKEN}`, host: 'attacker.example.com' },
        }),
      );
      expect(res.status).toBe(403);
    });

    it('keeps /healthz public', async () => {
      const app = buildApp({ dashboardRoot: null, authToken: TOKEN });
      const res = await fetch(app, '/healthz');
      expect(res.status).toBe(200);
    });

    it('serves a 401 page for / without a valid cookie', async () => {
      let tmpDir: string;
      tmpDir = await mkdtemp(path.join(tmpdir(), 'zhive-auth-test-'));
      try {
        await writeFile(path.join(tmpDir, 'index.html'), '<!doctype html><body>x</body>');
        const app = buildApp({ dashboardRoot: tmpDir, authToken: TOKEN });
        const res = await fetch(app, '/');
        expect(res.status).toBe(401);
        expect(await res.text()).toContain('cli start');
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('redirects / to a clean URL after a valid ?token= sets the cookie', async () => {
      let tmpDir: string;
      tmpDir = await mkdtemp(path.join(tmpdir(), 'zhive-auth-redir-'));
      try {
        await writeFile(path.join(tmpDir, 'index.html'), '<!doctype html><body>x</body>');
        const app = buildApp({ dashboardRoot: tmpDir, authToken: TOKEN });
        const res = await fetch(app, `/?token=${TOKEN}`);
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe('/');
        expect(res.headers.get('set-cookie')).toContain('zhive_auth=');
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('command and chat validation', () => {
    it('rejects unknown slash commands', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '/not-a-command' }),
      });
      expect(res.status).toBe(400);
      expect(control.executeCommand).not.toHaveBeenCalled();
    });

    it('accepts known slash commands', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '/help' }),
      });
      expect(res.status).toBe(200);
      expect(control.executeCommand).toHaveBeenCalledWith('/help');
    });

    it('rejects oversized chat text with 413', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const big = 'x'.repeat(8 * 1024 + 1);
      const res = await fetch(app, '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: big }),
      });
      expect(res.status).toBe(413);
      expect(control.submitChat).not.toHaveBeenCalled();
    });

    it('catches rejections from executeCommand and reports via the event bus', async () => {
      const control = fakeControl({
        executeCommand: vi.fn().mockRejectedValue(new Error('boom')),
      });
      const bus = new WebEventBus();
      const app = buildApp({ control, eventBus: bus, dashboardRoot: null });
      const res = await fetch(app, '/api/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '/help' }),
      });
      expect(res.status).toBe(200);
      // Wait a tick so the catch handler runs.
      await new Promise((r) => setTimeout(r, 0));
      const { events } = bus.since(0);
      expect(events.some((e) => e.type === 'error' && e.errorMessage === 'boom')).toBe(true);
    });
  });
});
