import { Hono } from 'hono';
import type { WebEventBus } from './events';
import type {
  AgentPortfolioRange,
  AgentTradingStatsV2BatchEntryDto,
  ClosedTradesTimeframe,
  WebControl,
} from './control';
import { SLASH_COMMANDS } from '../services/command-registry';
import {
  addApiGuard,
  addDashboardStatic,
  buildBaseUrl,
  defaultDashboardRoot,
  listenLocalhost,
} from './web-shared';

const VALID_PORTFOLIO_RANGES: ReadonlySet<AgentPortfolioRange> = new Set([
  '7d',
  '30d',
  '90d',
  'all',
]);

const VALID_CLOSED_TRADES_TIMEFRAMES: ReadonlySet<ClosedTradesTimeframe> = new Set([
  '24h',
  '7d',
  '30d',
  'all',
]);

/** Per-name stats map returned by `/api/agents/stats`. Picker agents that
 * haven't traded (or aren't on the leaderboard yet) map to `null`. */
export type AgentsStatsMap = Record<string, AgentTradingStatsV2BatchEntryDto | null>;

export const DEFAULT_WEB_PORT = 7878;
const MAX_CHAT_BYTES = 8 * 1024;
/** SOUL.md / STRATEGY.md cap. Markdown bodies are bounded by what an LLM
 * usefully consumes — well under 64KiB in practice. */
const MAX_MARKDOWN_BYTES = 64 * 1024;
/** Credentials body cap — generously large to fit a JSON wrapper around
 * a key that's at most a few hundred chars. */
const MAX_CREDENTIALS_BYTES = 4 * 1024;
/** Config body cap — bio + sector lists + watchlist are tiny in practice. */
const MAX_CONFIG_BYTES = 16 * 1024;

const ALLOWED_SENTIMENTS = new Set([
  'very-bullish',
  'bullish',
  'neutral',
  'bearish',
  'very-bearish',
]);
const ALLOWED_TIMEFRAMES = new Set(['4h', '24h', '7d']);

export interface PickerAgentSummary {
  name: string;
  /** ISO 8601 timestamp. */
  created: string;
  bio: string | null;
  avatarUrl?: string;
}

function pushError(eventBus: WebEventBus | null | undefined, errorMessage: string): void {
  eventBus?.push({ type: 'error', errorMessage });
}

export interface BuildAppOptions {
  // ─── Static (legacy) form ─────────────────────────────
  // Used by tests and simple deployments. Each field independently mounts
  // the routes that depend on it.
  eventBus?: WebEventBus;
  control?: WebControl;

  // ─── Dynamic form ─────────────────────────────────────
  // When set, the server reads runtime state lazily on each request so the
  // CLI can swap the active agent without restarting the listener. Returns
  // `null` while no agent is selected. Takes precedence over `eventBus` /
  // `control` when both are provided.
  getRuntimeState?: () => { control: WebControl; eventBus: WebEventBus } | null;

  /** Picker phase. Provide together with `getRuntimeState` so /api/state
   * can return `phase: 'selecting'` while no agent is loaded. */
  getAgents?: () => PickerAgentSummary[];
  /** Batched trading-stats provider for `/api/agents/stats`. Returns the
   * current cached snapshot keyed by agent name (or `null` for agents not
   * yet on the leaderboard). The TUI owns the underlying refresh loop +
   * cache — this just exposes whatever is currently buffered. */
  getAgentsStats?: () => AgentsStatsMap;
  /** Called with the chosen agent name. Fire-and-forget — the caller flips
   * `isStarting` and eventually `getRuntimeState` themselves. */
  onSelect?: (name: string) => Promise<void> | void;
  /** Called by the SPA when the user clicks "exit" in the dashboard. */
  onExit?: () => Promise<void> | void;
  /** True between `onSelect` returning and `getRuntimeState` becoming non-null
   * — used so /api/state can report `phase: 'starting'`. Defaults to false. */
  isStarting?: () => boolean;

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
  const { authToken } = options;
  const dashboardRoot =
    options.dashboardRoot === null ? null : (options.dashboardRoot ?? defaultDashboardRoot());

  // True when the caller wired up the dynamic accessors. Controls how routes
  // respond when no runtime is available: `503 agent not selected` for
  // dynamic (the SPA polls until ready), `404` for legacy (feature disabled).
  const dynamic = !!options.getRuntimeState;

  const resolveRuntime = (): { control?: WebControl; eventBus?: WebEventBus } => {
    if (options.getRuntimeState) {
      const state = options.getRuntimeState();
      if (!state) return {};
      return state;
    }
    return { control: options.control, eventBus: options.eventBus };
  };

  const slashNames = new Set(SLASH_COMMANDS.map((cmd) => cmd.name));

  app.get('/healthz', (c) => c.json({ ok: true }));

  addApiGuard(app, authToken);

  // ─── Picker endpoints ─────────────────────────────────
  // Mounted only when `getAgents` is provided.
  if (options.getAgents) {
    // Per-agent rank/stats for the picker UI. The TUI's background loop
    // owns the upstream fetch + cache; this endpoint just returns the
    // currently-buffered snapshot, so it's always cheap and never blocks
    // on Hive. Missing names are simply absent from the response.
    if (options.getAgentsStats) {
      app.get('/api/agents/stats', (c) => {
        return c.json(options.getAgentsStats!());
      });
    }

    app.post('/api/agents/select', async (c) => {
      const body = await c.req.json().catch(() => null);
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return c.json({ ok: false, error: 'Missing or invalid "name"' }, 400);
      }
      const validNames = new Set(options.getAgents!().map((a) => a.name));
      if (!validNames.has(name)) {
        return c.json({ ok: false, error: `Unknown agent: ${name}` }, 400);
      }
      // Fire-and-forget — the App's selectAgent handler does the work and
      // flips `isStarting` / `getRuntimeState` on its own timeline. Returning
      // 202 is the conventional "accepted, processing async" response.
      Promise.resolve(options.onSelect?.(name)).catch(() => {});
      return c.json({ ok: true }, 202);
    });

    app.post('/api/agents/exit', async (c) => {
      Promise.resolve(options.onExit?.()).catch(() => {});
      return c.json({ ok: true });
    });
  }

  // ─── /api/state ───────────────────────────────────────
  // Discriminator the SPA uses to flip between picker / starting splash /
  // dashboard. In dynamic mode, returns selecting/starting/ready based on
  // runtime presence. In legacy mode, mirrors the old behavior.
  app.get('/api/state', async (c) => {
    const { control } = resolveRuntime();
    if (!control) {
      if (dynamic && options.getAgents) {
        const phase = options.isStarting?.() ? 'starting' : 'selecting';
        return c.json({ phase, agents: options.getAgents() });
      }
      return c.notFound();
    }
    try {
      const payload = await control.getState();
      return c.json({ phase: 'ready', ...payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: message }, 503);
    }
  });

  // ─── Runtime endpoints ────────────────────────────────
  // Each guards on the specific dependency it needs. In dynamic mode, missing
  // runtime returns 503 ("agent not selected") so the SPA's polling can
  // recover automatically once the user picks an agent. In legacy mode,
  // missing dependency means the feature wasn't wired up — return 404.
  app.get('/api/events', (c) => {
    const { eventBus } = resolveRuntime();
    if (!eventBus) {
      return dynamic ? c.json({ ok: false, error: 'agent not selected' }, 503) : c.notFound();
    }
    const sinceParam = c.req.query('since');
    const parsed = sinceParam !== undefined ? Number.parseInt(sinceParam, 10) : 0;
    const since = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    const genParam = c.req.query('gen');
    const parsedGen = genParam !== undefined ? Number.parseInt(genParam, 10) : NaN;
    const clientGeneration = Number.isFinite(parsedGen) && parsedGen >= 1 ? parsedGen : undefined;
    return c.json(eventBus.since(since, clientGeneration));
  });

  app.post('/api/command', async (c) => {
    const { control, eventBus } = resolveRuntime();
    if (!control) {
      return dynamic ? c.json({ ok: false, error: 'agent not selected' }, 503) : c.notFound();
    }
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return c.json({ ok: false, error: 'Missing or invalid "name"' }, 400);
    }
    if (!slashNames.has(name)) {
      return c.json({ ok: false, error: `Unknown command: ${name}` }, 400);
    }
    control.executeCommand(name).catch((err) => {
      pushError(eventBus, err instanceof Error ? err.message : String(err));
    });
    return c.json({ ok: true });
  });

  app.post('/api/chat', async (c) => {
    const { control, eventBus } = resolveRuntime();
    if (!control) {
      return dynamic ? c.json({ ok: false, error: 'agent not selected' }, 503) : c.notFound();
    }
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

  app.get('/api/agent/profile', async (c) => {
    const { control } = resolveRuntime();
    if (!control) {
      return dynamic ? c.json({ ok: false, error: 'agent not selected' }, 503) : c.notFound();
    }
    try {
      const profile = await control.getAgentProfile();
      return c.json(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: message }, 503);
    }
  });

  app.get('/api/agent/portfolio', async (c) => {
    const { control } = resolveRuntime();
    if (!control) {
      return dynamic ? c.json({ ok: false, error: 'agent not selected' }, 503) : c.notFound();
    }
    const rangeParam = c.req.query('range');
    const range: AgentPortfolioRange =
      rangeParam && VALID_PORTFOLIO_RANGES.has(rangeParam as AgentPortfolioRange)
        ? (rangeParam as AgentPortfolioRange)
        : 'all';
    try {
      const portfolio = await control.getAgentPortfolio(range);
      return c.json(portfolio);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: message }, 503);
    }
  });

  app.get('/api/agent/positions', async (c) => {
    const { control } = resolveRuntime();
    if (!control) {
      return dynamic ? c.json({ ok: false, error: 'agent not selected' }, 503) : c.notFound();
    }
    try {
      const page = await control.getAgentPositions();
      return c.json(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: message }, 503);
    }
  });

  app.get('/api/agent/closed-trades', async (c) => {
    const { control } = resolveRuntime();
    if (!control) {
      return dynamic ? c.json({ ok: false, error: 'agent not selected' }, 503) : c.notFound();
    }
    const tfParam = c.req.query('timeframe');
    const timeframe: ClosedTradesTimeframe =
      tfParam && VALID_CLOSED_TRADES_TIMEFRAMES.has(tfParam as ClosedTradesTimeframe)
        ? (tfParam as ClosedTradesTimeframe)
        : 'all';
    try {
      const page = await control.getAgentClosedTrades(timeframe);
      return c.json(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: message }, 503);
    }
  });

  // ─── Config edit endpoints ────────────────────────────
  // All four require an active runtime — they mutate files in the agent's
  // directory and trigger a `reloadRuntime`.

  app.put('/api/agent/config', async (c) => {
    const { control } = resolveRuntime();
    if (!control) {
      return dynamic ? c.json({ ok: false, error: 'agent not selected' }, 503) : c.notFound();
    }
    const raw = await c.req.text();
    if (raw.length > MAX_CONFIG_BYTES) {
      return c.json({ ok: false, error: `body exceeds ${MAX_CONFIG_BYTES} bytes` }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return c.json({ ok: false, error: 'invalid JSON' }, 400);
    }
    if (!body || typeof body !== 'object') {
      return c.json({ ok: false, error: 'body must be an object' }, 400);
    }
    const partial = body as Record<string, unknown>;
    // Validate each declared field. Unknown keys are silently dropped to keep
    // the surface tight (a typo can't accidentally rewrite something).
    const validated: Record<string, unknown> = {};
    if (partial.bio !== undefined) {
      if (typeof partial.bio !== 'string') {
        return c.json({ ok: false, error: 'bio must be a string' }, 400);
      }
      validated.bio = partial.bio;
    }
    if (partial.avatarUrl !== undefined) {
      if (typeof partial.avatarUrl !== 'string') {
        return c.json({ ok: false, error: 'avatarUrl must be a string' }, 400);
      }
      validated.avatarUrl = partial.avatarUrl;
    }
    if (partial.watchList !== undefined) {
      if (
        !Array.isArray(partial.watchList) ||
        !partial.watchList.every((s) => typeof s === 'string')
      ) {
        return c.json({ ok: false, error: 'watchList must be string[]' }, 400);
      }
      validated.watchList = partial.watchList;
    }
    if (partial.sectors !== undefined) {
      if (!Array.isArray(partial.sectors) || !partial.sectors.every((s) => typeof s === 'string')) {
        return c.json({ ok: false, error: 'sectors must be string[]' }, 400);
      }
      validated.sectors = partial.sectors;
    }
    if (partial.sentiment !== undefined) {
      if (typeof partial.sentiment !== 'string' || !ALLOWED_SENTIMENTS.has(partial.sentiment)) {
        return c.json({ ok: false, error: 'invalid sentiment' }, 400);
      }
      validated.sentiment = partial.sentiment;
    }
    if (partial.timeframes !== undefined) {
      if (
        !Array.isArray(partial.timeframes) ||
        !partial.timeframes.every((t) => typeof t === 'string' && ALLOWED_TIMEFRAMES.has(t))
      ) {
        return c.json({ ok: false, error: 'invalid timeframes' }, 400);
      }
      validated.timeframes = partial.timeframes;
    }
    try {
      await control.updateConfig(validated);
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: message }, 500);
    }
  });

  app.put('/api/agent/soul', async (c) => {
    const { control } = resolveRuntime();
    if (!control) {
      return dynamic ? c.json({ ok: false, error: 'agent not selected' }, 503) : c.notFound();
    }
    const raw = await c.req.text();
    if (raw.length > MAX_MARKDOWN_BYTES) {
      return c.json({ ok: false, error: `body exceeds ${MAX_MARKDOWN_BYTES} bytes` }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return c.json({ ok: false, error: 'invalid JSON' }, 400);
    }
    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as { content?: unknown }).content !== 'string'
    ) {
      return c.json({ ok: false, error: 'body must be { content: string }' }, 400);
    }
    try {
      await control.updateSoul((body as { content: string }).content);
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: message }, 500);
    }
  });

  app.put('/api/agent/strategy', async (c) => {
    const { control } = resolveRuntime();
    if (!control) {
      return dynamic ? c.json({ ok: false, error: 'agent not selected' }, 503) : c.notFound();
    }
    const raw = await c.req.text();
    if (raw.length > MAX_MARKDOWN_BYTES) {
      return c.json({ ok: false, error: `body exceeds ${MAX_MARKDOWN_BYTES} bytes` }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return c.json({ ok: false, error: 'invalid JSON' }, 400);
    }
    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as { content?: unknown }).content !== 'string'
    ) {
      return c.json({ ok: false, error: 'body must be { content: string }' }, 400);
    }
    try {
      await control.updateStrategy((body as { content: string }).content);
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: message }, 500);
    }
  });

  app.put('/api/agent/credentials', async (c) => {
    const { control } = resolveRuntime();
    if (!control) {
      return dynamic ? c.json({ ok: false, error: 'agent not selected' }, 503) : c.notFound();
    }
    const raw = await c.req.text();
    if (raw.length > MAX_CREDENTIALS_BYTES) {
      return c.json({ ok: false, error: `body exceeds ${MAX_CREDENTIALS_BYTES} bytes` }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return c.json({ ok: false, error: 'invalid JSON' }, 400);
    }
    if (!body || typeof body !== 'object') {
      return c.json({ ok: false, error: 'body must be an object' }, 400);
    }
    const partial = body as Record<string, unknown>;
    const args: { apiKey?: string; providerEnvVar?: string; providerKey?: string } = {};
    if (partial.apiKey !== undefined) {
      if (typeof partial.apiKey !== 'string' || partial.apiKey.length === 0) {
        return c.json({ ok: false, error: 'apiKey must be a non-empty string' }, 400);
      }
      args.apiKey = partial.apiKey;
    }
    if (partial.providerEnvVar !== undefined) {
      if (
        typeof partial.providerEnvVar !== 'string' ||
        !/^[A-Z_][A-Z0-9_]*$/.test(partial.providerEnvVar)
      ) {
        return c.json({ ok: false, error: 'providerEnvVar must be a valid env var name' }, 400);
      }
      args.providerEnvVar = partial.providerEnvVar;
    }
    if (partial.providerKey !== undefined) {
      if (typeof partial.providerKey !== 'string') {
        return c.json({ ok: false, error: 'providerKey must be a string' }, 400);
      }
      args.providerKey = partial.providerKey;
    }
    if (Object.keys(args).length === 0) {
      return c.json({ ok: false, error: 'no credentials to update' }, 400);
    }
    try {
      await control.updateCredentials(args);
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: message }, 500);
    }
  });

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
