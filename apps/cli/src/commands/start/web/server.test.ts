import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildApp, type PickerAgentSummary } from './server';
import { WebEventBus } from './events';
import type { WebControl, WebState } from './control';
import { resetBacktestState, startBacktestSession } from '../../../shared/backtest/state';
import {
  resetBacktestCache,
  setBacktestError,
  setBacktestResult,
} from '../../../shared/backtest/web-cache';
import type { BacktestSummary } from '../../../shared/backtest/runner';

const AGENTS: PickerAgentSummary[] = [
  {
    name: 'sundae',
    created: '2026-01-01T00:00:00.000Z',
    bio: 'cone collector',
    hasProviderKey: true,
  },
  {
    name: 'comet',
    created: '2026-02-01T00:00:00.000Z',
    bio: null,
    hasProviderKey: false,
  },
];

function fakeControl(overrides: Partial<WebControl> = {}): WebControl {
  return {
    executeCommand: vi.fn().mockResolvedValue(undefined),
    submitChat: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue({
      agentName: 'test',
      bio: null,
      avatarUrl: null,
      watchlist: ['BTC', 'ETH'],
      positions: [],
      memory: '',
      soulContent: '',
      strategyContent: '',
      sectors: ['crypto'],
      sentiment: 'neutral',
      timeframes: ['4h'],
      providerEnvVar: null,
    } satisfies WebState),
    getAgentProfile: vi.fn().mockResolvedValue({
      name: 'test',
      bio: null,
      avatarUrl: null,
      frontendUrl: 'https://www.zhive.ai/agent/test',
      tradingRank: null,
    }),
    getAgentPortfolio: vi.fn().mockResolvedValue({
      agent_id: 'agent_test_id',
      starting_equity_usd: 10_000,
      current_equity_usd: 10_000,
      all_time_pnl_usd: 0,
      open_position_count: 0,
      total_trades: 0,
      daily_pnl: [],
    }),
    getAgentPositions: vi.fn().mockResolvedValue({ entries: [], next_cursor: null }),
    getAgentClosedTrades: vi.fn().mockResolvedValue({ entries: [], next_cursor: null }),
    updateConfig: vi.fn().mockResolvedValue(undefined),
    updateSoul: vi.fn().mockResolvedValue(undefined),
    updateStrategy: vi.fn().mockResolvedValue(undefined),
    updateCredentials: vi.fn().mockResolvedValue(undefined),
    getAvailableTickers: vi.fn().mockResolvedValue({
      crypto: ['BTC', 'ETH'],
      stockCommodity: ['xyz:MSTR', 'xyz:TSLA'],
    }),
    runBacktest: vi.fn().mockResolvedValue(undefined),
    getBacktestArtifacts: vi.fn().mockResolvedValue({ snapshots: [], fills: [] }),
    ...overrides,
  };
}

function makeBacktestSummary(): BacktestSummary {
  return {
    from: 1_700_000_000_000,
    to: 1_700_086_400_000,
    ticks: 24,
    initialCashUsd: 10_000,
    finalEquity: 10_500,
    totalReturnPct: 5,
    realizedPnl: 500,
    numFills: 4,
    numClosedTrades: 2,
    wins: 2,
    losses: 0,
    winRatePct: 100,
    maxDrawdownPct: 1,
    perAsset: { BTC: { realizedPnl: 500, numClosed: 2 } },
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
      expect(body.generation).toBe(1);
    });

    it('backfills events when ?gen mismatches the bus generation', async () => {
      const bus = new WebEventBus();
      bus.push({ type: 'message', text: 'old' });
      bus.reset();
      bus.push({ type: 'message', text: 'new-1' });
      bus.push({ type: 'message', text: 'new-2' });
      const app = buildApp({ eventBus: bus, dashboardRoot: null });

      // Stale cursor (since=99 from previous gen) + stale gen=1 → server
      // returns the new gen's full buffer instead of filtering it away.
      const res = await fetch(app, '/api/events?since=99&gen=1');
      const body = await res.json();
      expect(body.events.map((e: { seq: number }) => e.seq)).toEqual([1, 2]);
      expect(body.generation).toBe(2);
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

    it('GET /api/agent/profile returns the profile snapshot', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/agent/profile');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('test');
      expect(body.frontendUrl).toBe('https://www.zhive.ai/agent/test');
      expect(body.tradingRank).toBeNull();
    });

    it('GET /api/agent/profile returns 503 when getAgentProfile throws', async () => {
      const control = fakeControl({
        getAgentProfile: vi.fn().mockRejectedValue(new Error('not ready')),
      });
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/agent/profile');
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe('not ready');
    });

    it('GET /api/agent/portfolio forwards range and returns the upstream shape', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/agent/portfolio?range=30d');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.starting_equity_usd).toBe(10_000);
      expect(body.daily_pnl).toEqual([]);
      expect(control.getAgentPortfolio).toHaveBeenCalledWith('30d');
    });

    it('GET /api/agent/portfolio defaults to range=all when missing or invalid', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });

      await fetch(app, '/api/agent/portfolio');
      expect(control.getAgentPortfolio).toHaveBeenLastCalledWith('all');

      await fetch(app, '/api/agent/portfolio?range=bogus');
      expect(control.getAgentPortfolio).toHaveBeenLastCalledWith('all');
    });

    it('GET /api/agent/portfolio returns 503 when getAgentPortfolio throws', async () => {
      const control = fakeControl({
        getAgentPortfolio: vi.fn().mockRejectedValue(new Error('upstream down')),
      });
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/agent/portfolio?range=7d');
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe('upstream down');
    });

    it('GET /api/agent/positions returns the upstream page', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/agent/positions');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ entries: [], next_cursor: null });
      expect(control.getAgentPositions).toHaveBeenCalled();
    });

    it('GET /api/tickers returns the universe', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/tickers');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        crypto: ['BTC', 'ETH'],
        stockCommodity: ['xyz:MSTR', 'xyz:TSLA'],
      });
    });

    it('GET /api/agent/closed-trades forwards timeframe and defaults to all', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });

      await fetch(app, '/api/agent/closed-trades?timeframe=7d');
      expect(control.getAgentClosedTrades).toHaveBeenLastCalledWith('7d');

      await fetch(app, '/api/agent/closed-trades');
      expect(control.getAgentClosedTrades).toHaveBeenLastCalledWith('all');

      await fetch(app, '/api/agent/closed-trades?timeframe=bogus');
      expect(control.getAgentClosedTrades).toHaveBeenLastCalledWith('all');
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

    it('dynamic mode: /api/agents/stats returns the cached snapshot', async () => {
      const stats = {
        sundae: {
          agent_id: 'id_sundae',
          agent_name: 'sundae',
          total_trades: 12,
          total_pnl_usd: 320,
          roi_pct: 3.2,
          sharpe_ratio: 0,
          max_drawdown_pct: 0,
          win_rate_pct: 0.5,
          profit_factor: null,
          avg_hold_duration_ms: 0,
        },
        comet: null,
      };
      const app = buildApp({
        getRuntimeState: () => null,
        getAgents: () => AGENTS,
        getAgentsStats: () => stats,
        dashboardRoot: null,
      });
      const res = await fetch(app, '/api/agents/stats');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(stats);
    });

    it('dynamic mode: /api/agents/stats is omitted when getAgentsStats is not provided', async () => {
      const app = buildApp({
        getRuntimeState: () => null,
        getAgents: () => AGENTS,
        dashboardRoot: null,
      });
      const res = await fetch(app, '/api/agents/stats');
      expect(res.status).toBe(404);
    });

    it('dynamic mode: /api/state returns selecting when no runtime', async () => {
      const app = buildApp({
        getRuntimeState: () => null,
        getAgents: () => AGENTS,
        isStarting: () => false,
        dashboardRoot: null,
      });
      const res = await fetch(app, '/api/state');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.phase).toBe('selecting');
      expect(body.agents).toEqual(AGENTS);
    });

    it('dynamic mode: /api/state returns starting when isStarting() is true', async () => {
      const app = buildApp({
        getRuntimeState: () => null,
        getAgents: () => AGENTS,
        isStarting: () => true,
        dashboardRoot: null,
      });
      const res = await fetch(app, '/api/state');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.phase).toBe('starting');
      expect(body.agents).toEqual(AGENTS);
    });

    it('dynamic mode: /api/state returns ready once runtime is available', async () => {
      const control = fakeControl();
      const bus = new WebEventBus();
      const app = buildApp({
        getRuntimeState: () => ({ control, eventBus: bus }),
        getAgents: () => AGENTS,
        isStarting: () => false,
        dashboardRoot: null,
      });
      const res = await fetch(app, '/api/state');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.phase).toBe('ready');
      expect(body.agentName).toBe('test');
    });

    it('dynamic mode: /api/agents/select returns 202 and calls onSelect', async () => {
      const onSelect = vi.fn().mockResolvedValue(undefined);
      const app = buildApp({
        getRuntimeState: () => null,
        getAgents: () => AGENTS,
        onSelect,
        dashboardRoot: null,
      });
      const res = await fetch(app, '/api/agents/select', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'sundae' }),
      });
      expect(res.status).toBe(202);
      expect(onSelect).toHaveBeenCalledWith('sundae');
    });

    it('dynamic mode: /api/agents/select rejects unknown agents with 400', async () => {
      const onSelect = vi.fn();
      const app = buildApp({
        getRuntimeState: () => null,
        getAgents: () => AGENTS,
        onSelect,
        dashboardRoot: null,
      });
      const res = await fetch(app, '/api/agents/select', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'nope' }),
      });
      expect(res.status).toBe(400);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('dynamic mode: /api/agents/exit returns 200 and calls onExit', async () => {
      const control = fakeControl();
      const bus = new WebEventBus();
      const onExit = vi.fn().mockResolvedValue(undefined);
      const app = buildApp({
        getRuntimeState: () => ({ control, eventBus: bus }),
        getAgents: () => AGENTS,
        onExit,
        dashboardRoot: null,
      });
      const res = await fetch(app, '/api/agents/exit', { method: 'POST' });
      expect(res.status).toBe(200);
      expect(onExit).toHaveBeenCalledTimes(1);
    });

    it('dynamic mode: runtime endpoints return 503 when no runtime', async () => {
      const app = buildApp({
        getRuntimeState: () => null,
        getAgents: () => AGENTS,
        dashboardRoot: null,
      });
      const events = await fetch(app, '/api/events');
      expect(events.status).toBe(503);
      const command = await fetch(app, '/api/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '/help' }),
      });
      expect(command.status).toBe(503);
      const chat = await fetch(app, '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'hi' }),
      });
      expect(chat.status).toBe(503);
      const profile = await fetch(app, '/api/agent/profile');
      expect(profile.status).toBe(503);
    });

    // ─── Config edit endpoints ──────────────────────

    it('PUT /api/agent/config validates fields and forwards to updateConfig', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/agent/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bio: 'new bio', sentiment: 'bullish', watchList: ['BTC'] }),
      });
      expect(res.status).toBe(200);
      expect(control.updateConfig).toHaveBeenCalledWith({
        bio: 'new bio',
        sentiment: 'bullish',
        watchList: ['BTC'],
      });
    });

    it('PUT /api/agent/config rejects invalid sentiment with 400', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/agent/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sentiment: 'turbo' }),
      });
      expect(res.status).toBe(400);
      expect(control.updateConfig).not.toHaveBeenCalled();
    });

    it('PUT /api/agent/config rejects non-string watchList entries with 400', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/agent/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ watchList: ['BTC', 42] }),
      });
      expect(res.status).toBe(400);
      expect(control.updateConfig).not.toHaveBeenCalled();
    });

    it('PUT /api/agent/soul forwards content to updateSoul', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/agent/soul', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: '# new soul' }),
      });
      expect(res.status).toBe(200);
      expect(control.updateSoul).toHaveBeenCalledWith('# new soul');
    });

    it('PUT /api/agent/soul rejects missing content with 400', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/agent/soul', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      expect(control.updateSoul).not.toHaveBeenCalled();
    });

    it('PUT /api/agent/strategy forwards content to updateStrategy', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/agent/strategy', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: '# new strategy' }),
      });
      expect(res.status).toBe(200);
      expect(control.updateStrategy).toHaveBeenCalledWith('# new strategy');
    });

    it('PUT /api/agent/credentials forwards apiKey-only update', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/agent/credentials', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey: 'sk-test-rotated' }),
      });
      expect(res.status).toBe(200);
      expect(control.updateCredentials).toHaveBeenCalledWith({ apiKey: 'sk-test-rotated' });
    });

    it('PUT /api/agent/credentials rejects invalid env var name with 400', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/agent/credentials', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerEnvVar: 'has spaces', providerKey: 'x' }),
      });
      expect(res.status).toBe(400);
      expect(control.updateCredentials).not.toHaveBeenCalled();
    });

    it('PUT /api/agent/credentials rejects empty body with 400', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/agent/credentials', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      expect(control.updateCredentials).not.toHaveBeenCalled();
    });

    it('config edit endpoints return 503 in dynamic mode when no runtime', async () => {
      const app = buildApp({
        getRuntimeState: () => null,
        getAgents: () => AGENTS,
        dashboardRoot: null,
      });
      const config = await fetch(app, '/api/agent/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bio: 'x' }),
      });
      expect(config.status).toBe(503);
      const soul = await fetch(app, '/api/agent/soul', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: 'x' }),
      });
      expect(soul.status).toBe(503);
      const creds = await fetch(app, '/api/agent/credentials', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey: 'x' }),
      });
      expect(creds.status).toBe(503);
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

  describe('backtest routes', () => {
    const START_BODY = {
      from: 1_700_000_000_000,
      to: 1_700_086_400_000,
      coin: 'BTC',
      intervalMs: 3_600_000,
      initialCashUsd: 10_000,
    };

    afterEach(() => {
      resetBacktestCache();
      resetBacktestState();
    });

    it('POST /api/backtest/start returns 202 when idle', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/backtest/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(START_BODY),
      });
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ ok: true });
      expect(control.runBacktest).toHaveBeenCalledWith(START_BODY);
    });

    it('POST /api/backtest/start returns 409 when another run is in flight', async () => {
      // Seed the singleton so the route handler can include progress in
      // the 409 body. The mock control then throws the "already running"
      // sentinel the route looks for.
      startBacktestSession({
        from: START_BODY.from,
        to: START_BODY.to,
        intervalMs: START_BODY.intervalMs,
        initialCashUsd: START_BODY.initialCashUsd,
        watchList: ['BTC'],
        source: 'web',
      });
      const control = fakeControl({
        runBacktest: vi.fn().mockRejectedValue(new Error('A backtest is already running')),
      });
      const app = buildApp({ control, dashboardRoot: null });

      const res = await fetch(app, '/api/backtest/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(START_BODY),
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.running).toBeDefined();
      expect(body.running.from).toBe(START_BODY.from);
    });

    it('POST /api/backtest/start rejects from > to with 400', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/backtest/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...START_BODY, from: START_BODY.to, to: START_BODY.from }),
      });
      expect(res.status).toBe(400);
      expect(control.runBacktest).not.toHaveBeenCalled();
    });

    it('POST /api/backtest/start rejects cash = 0 with 400', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/backtest/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...START_BODY, initialCashUsd: 0 }),
      });
      expect(res.status).toBe(400);
      expect(control.runBacktest).not.toHaveBeenCalled();
    });

    it('POST /api/backtest/start rejects missing coin with 400', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const { coin: _omit, ...rest } = START_BODY;
      const res = await fetch(app, '/api/backtest/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(rest),
      });
      expect(res.status).toBe(400);
      expect(control.runBacktest).not.toHaveBeenCalled();
    });

    it('GET /api/backtest/status returns idle when nothing has run', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/backtest/status');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'idle' });
    });

    it('GET /api/backtest/status returns running when the session is active', async () => {
      startBacktestSession({
        from: START_BODY.from,
        to: START_BODY.to,
        intervalMs: START_BODY.intervalMs,
        initialCashUsd: START_BODY.initialCashUsd,
        watchList: ['BTC'],
        source: 'web',
      });
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/backtest/status');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('running');
      expect(body.progress.from).toBe(START_BODY.from);
    });

    it('GET /api/backtest/status returns completed when a summary is cached', async () => {
      setBacktestResult(makeBacktestSummary());
      setBacktestError(null);
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/backtest/status');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('completed');
      expect(body.summary.finalEquity).toBe(10_500);
    });

    it('GET /api/backtest/status returns failed when an error is cached', async () => {
      setBacktestError('boom');
      setBacktestResult(null);
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/backtest/status');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('failed');
      expect(body.error).toBe('boom');
    });

    it('GET /api/backtest/artifacts forwards control output', async () => {
      const control = fakeControl();
      const app = buildApp({ control, dashboardRoot: null });
      const res = await fetch(app, '/api/backtest/artifacts');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ snapshots: [], fills: [] });
      expect(control.getBacktestArtifacts).toHaveBeenCalled();
    });

    it('GET /api/backtest/artifacts returns 503 in dynamic mode when no runtime', async () => {
      const app = buildApp({
        getRuntimeState: () => null,
        getAgents: () => AGENTS,
        dashboardRoot: null,
      });
      const res = await fetch(app, '/api/backtest/artifacts');
      expect(res.status).toBe(503);
    });
  });
});
