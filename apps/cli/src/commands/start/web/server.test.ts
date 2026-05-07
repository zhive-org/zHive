import { describe, it, expect, vi } from 'vitest';
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
    const app = buildApp({});
    const res = await fetch(app, '/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('omits /api routes when neither bus nor control supplied', async () => {
    const app = buildApp({});
    const events = await fetch(app, '/api/events');
    expect(events.status).toBe(404);
    const state = await fetch(app, '/api/state');
    expect(state.status).toBe(404);
  });

  describe('with eventBus', () => {
    it('returns events since seq', async () => {
      const bus = new WebEventBus();
      bus.push({ type: 'message', text: 'a' });
      bus.push({ type: 'message', text: 'b' });
      const app = buildApp({ eventBus: bus });

      const res = await fetch(app, '/api/events?since=1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.events.map((e: { seq: number }) => e.seq)).toEqual([2]);
      expect(body.latest).toBe(2);
    });
  });

  describe('with control', () => {
    it('POST /api/command dispatches and returns ok', async () => {
      const control = fakeControl();
      const app = buildApp({ control });

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
      const app = buildApp({ control });

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
      const app = buildApp({ control });

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
      const app = buildApp({ control });

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
      const app = buildApp({ control });

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
      const app = buildApp({ control });

      const res = await fetch(app, '/api/state');
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe('not ready');
    });
  });
});
