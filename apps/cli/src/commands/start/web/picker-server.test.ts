import { describe, it, expect } from 'vitest';
import { buildPickerApp, type PickerAgentSummary } from './picker-server';

const AGENTS: PickerAgentSummary[] = [
  { name: 'sundae', created: '2026-01-01T00:00:00.000Z', bio: 'cone collector' },
  { name: 'comet', created: '2026-02-01T00:00:00.000Z', bio: null },
];

function fetch(app: ReturnType<typeof buildPickerApp>, path: string, init?: RequestInit) {
  return app.fetch(new Request(`http://localhost${path}`, init));
}

describe('buildPickerApp', () => {
  it('GET /api/state returns the selecting phase with agents', async () => {
    const app = buildPickerApp({ agents: AGENTS, onSelect: () => {}, dashboardRoot: null });
    const res = await fetch(app, '/api/state');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phase).toBe('selecting');
    expect(body.agents).toEqual(AGENTS);
  });

  it('POST /api/agents/select calls onSelect with the chosen name', async () => {
    let chosen: string | null = null;
    const app = buildPickerApp({
      agents: AGENTS,
      onSelect: (name) => {
        chosen = name;
      },
      dashboardRoot: null,
    });
    const res = await fetch(app, '/api/agents/select', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'sundae' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(chosen).toBe('sundae');
  });

  it('POST /api/agents/select rejects unknown agents', async () => {
    let chosen: string | null = null;
    const app = buildPickerApp({
      agents: AGENTS,
      onSelect: (name) => {
        chosen = name;
      },
      dashboardRoot: null,
    });
    const res = await fetch(app, '/api/agents/select', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'nope' }),
    });
    expect(res.status).toBe(400);
    expect(chosen).toBeNull();
  });

  it('POST /api/agents/select rejects missing name', async () => {
    const app = buildPickerApp({ agents: AGENTS, onSelect: () => {}, dashboardRoot: null });
    const res = await fetch(app, '/api/agents/select', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('runtime endpoints respond with 503 in selecting mode', async () => {
    const app = buildPickerApp({ agents: AGENTS, onSelect: () => {}, dashboardRoot: null });
    const events = await fetch(app, '/api/events');
    expect(events.status).toBe(503);
    const command = await fetch(app, '/api/command', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '/help' }),
    });
    expect(command.status).toBe(503);
  });

  it('blocks /api/* without a token when authToken is set', async () => {
    const app = buildPickerApp({
      agents: AGENTS,
      onSelect: () => {},
      dashboardRoot: null,
      authToken: 'secret',
    });
    const res = await fetch(app, '/api/state');
    expect(res.status).toBe(401);
  });

  it('accepts /api/* with a valid bearer token', async () => {
    const app = buildPickerApp({
      agents: AGENTS,
      onSelect: () => {},
      dashboardRoot: null,
      authToken: 'secret',
    });
    const res = await fetch(app, '/api/state', {
      headers: { authorization: 'Bearer secret' },
    });
    expect(res.status).toBe(200);
  });

  it('rejects non-localhost host', async () => {
    const app = buildPickerApp({ agents: AGENTS, onSelect: () => {}, dashboardRoot: null });
    const res = await app.fetch(
      new Request('http://attacker.example.com/api/state', {
        headers: { host: 'attacker.example.com' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('keeps /healthz public', async () => {
    const app = buildPickerApp({
      agents: AGENTS,
      onSelect: () => {},
      dashboardRoot: null,
      authToken: 'secret',
    });
    const res = await fetch(app, '/healthz');
    expect(res.status).toBe(200);
  });
});
