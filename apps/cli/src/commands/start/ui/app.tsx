import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Box, Static, Text } from 'ink';
import {
  HiveClient,
  loadMemory,
  type AgentPortfolioRange,
  type AgentPortfolioV2Dto,
  type AgentTradingStatsV2BatchEntryDto,
  type ClosedTradesPageDto,
  type ClosedTradesTimeframe,
  type PositionsPageDto,
} from '@zhive/sdk';
import { useAgent } from '../hooks/useAgent';
import { PollText, Spinner } from './Spinner';
import { CommandInput } from './CommandInput';
import { border, colors, symbols } from '../../shared/theme';
import { HIVE_API_URL, HIVE_FRONTEND_URL } from '../../../shared/config/constant';
import { formatTime } from '../../../shared/utils';
import { useChat } from '../hooks/useChat';
import { activityFormatter } from '../hooks/utils';
import { PositionsView } from '../../../components/PositionsView';
import { WatchlistView } from '../../../components/WatchlistView';
import { useAgentRuntime } from '../hooks/useAgentRuntime';
import { useWebServer } from '../hooks/useWebServer';
import { WebEventBus } from '../web/events';
import { attachErrorBridge } from '../web/error-bridge';
import type {
  AgentConfigUpdate,
  AgentProfileResponse,
  AgentTradingRank,
  CredentialsUpdate,
  WebControl,
  WebState,
} from '../web/control';
import type { AgentsStatsMap, PickerAgentSummary } from '../web/server';
import { executeSlashCommand, type SlashCommandCallbacks } from '../services/command-registry';
import { ZhiveExchange } from '../../../shared/trading/exchange/zhive';
import type { DetailedPosition } from '../../../shared/trading/types';
import { TtlCache } from '../../../shared/cache/ttl-cache';
import { AgentConfig, loadAgentConfig } from '../../../shared/config/agent';
import { loadAgentEnv, getAgentProviderKeys, updateEnvVar } from '../../../shared/config/env-loader';
import { getModel } from '../../../shared/config/ai-providers';
import { loadConfig as sdkLoadConfig, saveConfig as sdkSaveConfig } from '@zhive/sdk';
import { promises as fsp } from 'fs';
import * as nodePath from 'path';
import { loadSkills } from '../../../shared/agent/skills/loader';
import { createBuiltinTools, type AgentRuntime } from '../../../shared/agent/runtime';
import { createExecuteSkillTool } from '../../../shared/tools/execute-skill';
import { resetAgentScopedState, resetSharedCaches } from '../../../shared/reset-caches';

const POSITIONS_TTL_MS = 5_000;
const AGENT_PROFILE_TTL_MS = 60_000;
const AGENT_PORTFOLIO_TTL_MS = 60_000;
const AGENT_POSITIONS_TTL_MS = 5_000;
const AGENT_CLOSED_TRADES_TTL_MS = 30_000;
const PICKER_STATS_REFRESH_MS = 60_000;

interface HiveAgentLookup {
  id: string;
  bio?: string;
  avatar_url?: string;
}

interface HiveAgentRankResponse {
  rank: number;
  total_trades: number;
  total_pnl_usd: number;
  roi_pct: number;
  win_rate_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  profit_factor: number | null;
}

async function fetchAgentTradingRank(name: string): Promise<AgentTradingRank | null> {
  // Two-step lookup mirrors zhive-app: name → id → rank. Best-effort —
  // any failure returns null so the dashboard still renders the agent card.
  try {
    const agentRes = await axios.get<HiveAgentLookup>(
      `${HIVE_API_URL}/agent/${encodeURIComponent(name)}`,
      { timeout: 5_000 },
    );
    const agentId = agentRes.data?.id;
    if (!agentId) return null;
    const rankRes = await axios.get<HiveAgentRankResponse>(
      `${HIVE_API_URL}/leaderboard/v2/rank/${encodeURIComponent(agentId)}`,
      { timeout: 5_000 },
    );
    const r = rankRes.data;
    return {
      rank: r.rank,
      total_trades: r.total_trades,
      total_pnl_usd: r.total_pnl_usd,
      roi_pct: r.roi_pct,
      win_rate_pct: r.win_rate_pct,
      sharpe_ratio: r.sharpe_ratio,
      max_drawdown_pct: r.max_drawdown_pct,
      profit_factor: r.profit_factor,
    };
  } catch {
    return null;
  }
}

function toPickerSummary(agent: AgentConfig): PickerAgentSummary {
  return {
    name: agent.name,
    created: agent.created.toISOString(),
    bio: agent.bio,
    avatarUrl: agent.avatarUrl,
  };
}

// ─── Main TUI App ────────────────────────────────────

export interface AppProps {
  /** Pre-scanned agent list shown in the web picker. Empty/single-element
   * lists are fine — the picker handles both. */
  agents?: AgentConfig[];
  /** If set, the App auto-runs `selectAgent(initialAgent)` on mount,
   * skipping the picker. Used by the `--agent <name>` flag and by the
   * "cwd is an agent dir" auto-detection. */
  initialAgent?: string;
  webPort?: number;
  openInBrowser?: boolean;
  /** Reuse this auth token instead of generating one (deprecated picker
   * handoff — kept for back-compat with callers; the unified server doesn't
   * need a handoff anymore). */
  webAuthToken?: string;
}

export const App: React.FC<AppProps> = ({
  agents = [],
  initialAgent,
  webPort,
  openInBrowser,
  webAuthToken,
}) => {
  const { runtime, reloadRuntime, setRuntime } = useAgentRuntime();
  const [isStarting, setIsStarting] = useState(false);
  const [termWidth, setTermWidth] = useState(process.stdout.columns || 60);
  const eventBus = useMemo(() => new WebEventBus(), []);
  const exchangeRef = useRef<{ apiKey: string; client: Promise<ZhiveExchange> } | null>(null);
  const positionsCacheRef = useRef<{ ts: number; positions: DetailedPosition[] } | null>(null);
  const profileCacheRef = useRef<TtlCache<AgentProfileResponse> | null>(null);
  if (!profileCacheRef.current) {
    profileCacheRef.current = new TtlCache<AgentProfileResponse>(AGENT_PROFILE_TTL_MS);
  }
  const portfolioCacheRef = useRef<TtlCache<AgentPortfolioV2Dto> | null>(null);
  if (!portfolioCacheRef.current) {
    portfolioCacheRef.current = new TtlCache<AgentPortfolioV2Dto>(AGENT_PORTFOLIO_TTL_MS);
  }
  const agentPositionsCacheRef = useRef<TtlCache<PositionsPageDto> | null>(null);
  if (!agentPositionsCacheRef.current) {
    agentPositionsCacheRef.current = new TtlCache<PositionsPageDto>(AGENT_POSITIONS_TTL_MS);
  }
  const closedTradesCacheRef = useRef<TtlCache<ClosedTradesPageDto> | null>(null);
  if (!closedTradesCacheRef.current) {
    closedTradesCacheRef.current = new TtlCache<ClosedTradesPageDto>(AGENT_CLOSED_TRADES_TTL_MS);
  }
  // Public Hive client — no API key needed for the leaderboard/portfolio
  // reads we use here (both are unauthenticated endpoints upstream).
  const publicHiveClientRef = useRef<HiveClient | null>(null);
  if (!publicHiveClientRef.current) {
    publicHiveClientRef.current = new HiveClient(HIVE_API_URL);
  }
  // Resolved Mongo agent_ids keyed by agent name. Populated lazily on the
  // first portfolio request for each agent; survives an agent boundary so
  // we don't refetch the lookup on every picker → dashboard transition.
  const agentIdCacheRef = useRef<Map<string, string>>(new Map());
  // Latest batched picker stats snapshot. The background loop fills this;
  // the server's /api/agents/stats reads from it synchronously.
  const agentsStatsRef = useRef<AgentsStatsMap>({});

  const {
    connected,
    agentName,
    modelInfo,
    activePollActivities,
    settledPollActivities,
  } = useAgent({ runtime, eventBus });

  const {
    input,
    chatActivity,
    chatBuffer,
    chatStreaming,
    overlay,
    handleChatSubmit,
    setInput,
    closeOverlay,
    clearChat,
  } = useChat({ runtime, reloadRuntime, eventBus });

  // Resolve the active agent's Mongo `agent_id`, throwing if no runtime is
  // mounted. Caches the lookup per-name so the Hive `/agent/:name` call
  // happens at most once per agent lifetime, then survives the TtlCache
  // expiries for downstream portfolio/positions/closed-trades calls.
  const resolveActiveAgentId = useCallback(async (): Promise<string> => {
    if (!runtime) {
      throw new Error('Runtime not ready');
    }
    const name = runtime.config.name;
    const cached = agentIdCacheRef.current.get(name);
    if (cached) return cached;
    const res = await axios.get<{ id?: string }>(
      `${HIVE_API_URL}/agent/${encodeURIComponent(name)}`,
      { timeout: 5_000 },
    );
    const resolved = res.data?.id;
    if (!resolved) {
      throw new Error(`Agent not registered with zHive: ${name}`);
    }
    agentIdCacheRef.current.set(name, resolved);
    return resolved;
  }, [runtime]);

  const control = useMemo<WebControl>(
    () => ({
      async executeCommand(name) {
        if (!runtime) {
          eventBus.push({ type: 'error', errorMessage: 'Runtime not ready' });
          return;
        }
        const callbacks: SlashCommandCallbacks = {
          onMessage: (text) => eventBus.push({ type: 'chat', role: 'agent', text }),
          onError: (text) => eventBus.push({ type: 'chat', role: 'error', text }),
          onClear: () => {
            clearChat();
            eventBus.push({ type: 'system', kind: 'clear-chat' });
          },
          onOverlayOpen: (overlay) => {
            const text =
              overlay?.type === 'positions'
                ? `Positions overlay opened (${overlay.positions.length} open). Fetch /api/state for details.`
                : overlay?.type === 'watchlist'
                  ? 'Watchlist overlay opened. Fetch /api/state for the current list.'
                  : 'Overlay opened.';
            eventBus.push({ type: 'chat', role: 'agent', text });
          },
        };
        await executeSlashCommand(name, runtime, callbacks);
      },
      async submitChat(text) {
        if (!runtime) {
          eventBus.push({ type: 'error', errorMessage: 'Runtime not ready' });
          return;
        }
        if (text.trim().startsWith('/')) {
          eventBus.push({
            type: 'chat',
            role: 'error',
            text: 'Slash commands must be sent to POST /api/command',
          });
          return;
        }
        void handleChatSubmit(text);
      },
      async getState(): Promise<WebState> {
        if (!runtime) {
          throw new Error('Runtime not ready');
        }
        const apiKey = runtime.config.apiKey;
        if (exchangeRef.current?.apiKey !== apiKey) {
          exchangeRef.current = { apiKey, client: ZhiveExchange.create({ apiKey }) };
          positionsCacheRef.current = null;
        }
        const cache = positionsCacheRef.current;
        const now = Date.now();
        let positions: DetailedPosition[];
        if (cache && now - cache.ts < POSITIONS_TTL_MS) {
          positions = cache.positions;
        } else {
          const exchange = await exchangeRef.current.client;
          positions = await exchange.fetchPositions();
          positionsCacheRef.current = { ts: now, positions };
        }
        const memory = await loadMemory();
        // Pick the first provider key the agent declares in its .env. The
        // model loader iterates this set in declaration order, so the first
        // is the active one. Returns null if the agent inherits a key from
        // the user's shell instead — the SPA handles both.
        const providerEnvVar = Array.from(getAgentProviderKeys())[0] ?? null;
        return {
          agentName: runtime.config.name,
          bio: runtime.config.bio,
          avatarUrl: runtime.config.avatarUrl ?? null,
          watchlist: runtime.config.watchList,
          positions,
          memory,
          soulContent: runtime.config.soulContent,
          strategyContent: runtime.config.strategyContent,
          sectors: runtime.config.agentProfile.sectors,
          sentiment: runtime.config.agentProfile.sentiment,
          timeframes: runtime.config.agentProfile.timeframes,
          providerEnvVar,
        };
      },
      async updateConfig(partial: AgentConfigUpdate): Promise<void> {
        if (!runtime) throw new Error('Runtime not ready');
        const stored = await sdkLoadConfig();
        if (!stored) throw new Error('config.json not found');
        // Mutable subset only — `name`, `apiKey`, `version` are intentionally
        // not in `AgentConfigUpdate` so a malformed PUT can't rename the
        // agent or drop its credentials.
        const next = stored as typeof stored & { watchList?: string[] };
        if (partial.bio !== undefined) next.bio = partial.bio;
        if (partial.avatarUrl !== undefined) next.avatarUrl = partial.avatarUrl;
        if (partial.sectors !== undefined) next.sectors = partial.sectors;
        if (partial.sentiment !== undefined) next.sentiment = partial.sentiment;
        if (partial.timeframes !== undefined) next.timeframes = partial.timeframes;
        if (partial.watchList !== undefined) next.watchList = partial.watchList;
        await sdkSaveConfig(next);
        await reloadRuntime();
      },
      async updateSoul(content: string): Promise<void> {
        if (!runtime) throw new Error('Runtime not ready');
        await fsp.writeFile(nodePath.join(runtime.config.dir, 'SOUL.md'), content, 'utf-8');
        await reloadRuntime();
      },
      async updateStrategy(content: string): Promise<void> {
        if (!runtime) throw new Error('Runtime not ready');
        await fsp.writeFile(nodePath.join(runtime.config.dir, 'STRATEGY.md'), content, 'utf-8');
        await reloadRuntime();
      },
      async updateCredentials(args: CredentialsUpdate): Promise<void> {
        if (!runtime) throw new Error('Runtime not ready');
        // Branch on what the caller actually wants to change. Both fields
        // optional so the caller can rotate just one.
        if (args.apiKey !== undefined) {
          const stored = await sdkLoadConfig();
          if (!stored) throw new Error('config.json not found');
          stored.apiKey = args.apiKey;
          await sdkSaveConfig(stored);
        }
        if (args.providerEnvVar && args.providerKey !== undefined) {
          updateEnvVar(runtime.config.dir, args.providerEnvVar, args.providerKey);
          // Reload .env into process.env AND drop the cached language model
          // so the next inference picks up the new key.
          await loadAgentEnv();
          resetSharedCaches();
        }
        await reloadRuntime();
      },
      async getAgentProfile(): Promise<AgentProfileResponse> {
        if (!runtime) {
          throw new Error('Runtime not ready');
        }
        const name = runtime.config.name;
        const profileCache = profileCacheRef.current!;
        return profileCache.getOrFetch(name, async () => {
          const tradingRank = await fetchAgentTradingRank(name);
          return {
            name,
            bio: runtime.config.bio,
            avatarUrl: runtime.config.avatarUrl ?? null,
            frontendUrl: `${HIVE_FRONTEND_URL}/agent/${encodeURIComponent(name)}`,
            tradingRank,
          };
        });
      },
      async getAgentPortfolio(range: AgentPortfolioRange): Promise<AgentPortfolioV2Dto> {
        const agentId = await resolveActiveAgentId();
        return portfolioCacheRef.current!.getOrFetch(`${agentId}:${range}`, () =>
          publicHiveClientRef.current!.trading.getAgentPortfolioV2(agentId, range),
        );
      },
      async getAgentPositions(): Promise<PositionsPageDto> {
        const agentId = await resolveActiveAgentId();
        return agentPositionsCacheRef.current!.getOrFetch(agentId, () =>
          publicHiveClientRef.current!.trading.getAgentPositions(agentId),
        );
      },
      async getAgentClosedTrades(timeframe: ClosedTradesTimeframe): Promise<ClosedTradesPageDto> {
        const agentId = await resolveActiveAgentId();
        return closedTradesCacheRef.current!.getOrFetch(`${agentId}:${timeframe}`, () =>
          publicHiveClientRef.current!.trading.getAgentClosedTrades(agentId, timeframe),
        );
      },
    }),
    [runtime, eventBus, handleChatSubmit, clearChat, reloadRuntime, resolveActiveAgentId],
  );

  // ─── Agent select / exit ────────────────────────────
  // Stable refs so the lazy server accessors below see fresh state without
  // re-binding the listener on every render.
  const runtimeRef = useRef(runtime);
  const controlRef = useRef(control);
  const isStartingRef = useRef(isStarting);
  const agentsRef = useRef(agents);
  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);
  useEffect(() => {
    controlRef.current = control;
  }, [control]);
  useEffect(() => {
    isStartingRef.current = isStarting;
  }, [isStarting]);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const selectAgent = useCallback(
    async (name: string): Promise<void> => {
      const agent = agentsRef.current.find((a) => a.name === name);
      if (!agent) {
        eventBus.push({ type: 'error', errorMessage: `Agent not found: ${name}` });
        return;
      }
      if (runtimeRef.current || isStartingRef.current) {
        // Guard against double-fire from the picker (rapid clicks).
        return;
      }
      // Write the ref synchronously so the next /api/state response from the
      // server sees `phase: 'starting'` even if React hasn't yet committed
      // the setIsStarting state update. The useEffect below will reconcile
      // either way.
      isStartingRef.current = true;
      setIsStarting(true);
      try {
        process.chdir(agent.dir);
        await loadAgentEnv();
        // Load config first to get apiKey, then parallelize everything else
        // including the exchange handshake so the dashboard renders fully
        // populated on the first /api/state poll instead of empty-then-late.
        const config = await loadAgentConfig();
        const [memory, model, skills, exchange] = await Promise.all([
          loadMemory(),
          getModel(),
          loadSkills(),
          ZhiveExchange.create({ apiKey: config.apiKey }),
        ]);
        const positions = await exchange.fetchPositions();

        const builtinTools = createBuiltinTools();
        const executeSkillTool = createExecuteSkillTool(skills, {
          model,
          tools: builtinTools,
        });
        const allTools = { ...builtinTools, executeSkillTool };
        const next: AgentRuntime = {
          config,
          memory,
          tools: allTools,
          skills,
          model,
        };

        // Pre-fill caches that getState() consults so the SPA's first
        // /api/state poll is a synchronous object read, not a 1-3s round trip.
        exchangeRef.current = { apiKey: config.apiKey, client: Promise.resolve(exchange) };
        positionsCacheRef.current = { ts: Date.now(), positions };
        // Write the runtime ref synchronously so getRuntimeState() returns
        // the new runtime on the very next request — even before React's
        // commit phase runs the syncing useEffect.
        runtimeRef.current = next;
        setRuntime(next);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        eventBus.push({ type: 'error', errorMessage: `Failed to start agent: ${errorMessage}` });
      } finally {
        isStartingRef.current = false;
        setIsStarting(false);
      }
    },
    [eventBus, setRuntime],
  );

  const exitAgent = useCallback(async (): Promise<void> => {
    if (!runtimeRef.current && !isStartingRef.current) return;
    // Clear the runtime ref FIRST, synchronously, so any /api/state request
    // arriving between this call and React's commit returns `phase:
    // 'selecting'` immediately. Otherwise the SPA's invalidate-and-refetch
    // could race React and snapshot the still-ready state, delaying the
    // picker by a full 30s poll cycle.
    runtimeRef.current = undefined;
    // useAgent's effect cleanup will stop the trading agent when runtime
    // becomes undefined, so we don't have to touch agentRef here.
    profileCacheRef.current?.clear?.();
    exchangeRef.current = null;
    positionsCacheRef.current = null;
    resetAgentScopedState(eventBus);
    setRuntime(undefined);
  }, [eventBus, setRuntime]);

  // Auto-select on mount when a flag/cwd-detection pre-chose an agent.
  // Empty deps: only runs once at mount, mirroring how `--agent` worked
  // with the old selectAgentInBrowser path.
  useEffect(() => {
    if (initialAgent) {
      void selectAgent(initialAgent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Web server (binds once at mount, never restarts on agent switch) ─
  const getRuntimeState = useCallback(() => {
    if (!runtimeRef.current) return null;
    return { control: controlRef.current, eventBus };
  }, [eventBus]);
  const getAgents = useCallback(() => agentsRef.current.map(toPickerSummary), []);
  const getAgentsStats = useCallback<() => AgentsStatsMap>(() => agentsStatsRef.current, []);
  const onSelect = useCallback(
    (name: string) => {
      void selectAgent(name);
    },
    [selectAgent],
  );
  const onExit = useCallback(() => {
    void exitAgent();
  }, [exitAgent]);
  const isStartingFn = useCallback(() => isStartingRef.current, []);

  const webServer = useWebServer({
    port: webPort,
    authToken: webAuthToken,
    openInBrowser,
    getRuntimeState,
    getAgents,
    getAgentsStats,
    onSelect,
    onExit,
    isStarting: isStartingFn,
  });

  // ─── Background picker stats refresh ────────────────
  // Fan-out a single batched Hive call for all known agent names. Runs on
  // mount and every 60s. The picker UI polls `/api/agents/stats`, which
  // just reads `agentsStatsRef.current` synchronously, so the upstream
  // round-trip never sits in the request path.
  useEffect(() => {
    let cancelled = false;
    const refresh = async (): Promise<void> => {
      const names = agentsRef.current.map((a) => a.name);
      if (names.length === 0) return;
      try {
        const entries = await publicHiveClientRef.current!.trading.getStatByNames(names);
        if (cancelled) return;
        const next: AgentsStatsMap = {};
        for (const name of names) next[name] = null;
        for (const entry of entries) next[entry.agent_name] = entry;
        agentsStatsRef.current = next;
      } catch {
        // Best-effort — leave the previous snapshot in place on transient
        // Hive failures rather than wiping the picker UI to blanks.
      }
    };
    void refresh();
    const id = setInterval(() => void refresh(), PICKER_STATS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // ─── Terminal resize tracking ───────────────────────
  useEffect(() => {
    const onResize = (): void => {
      setTermWidth(process.stdout.columns || 60);
    };
    process.stdout.on('resize', onResize);
    return () => {
      process.stdout.off('resize', onResize);
    };
  }, []);

  // ─── Error bridge: console.error / unhandled / uncaught → eventBus ──
  // Mirrors process-level errors into the dashboard's ActivityFeed so the
  // user doesn't have to flip back to the terminal to spot a 429 or stack
  // trace from a third-party SDK.
  useEffect(() => {
    const handle = attachErrorBridge(eventBus);
    return () => {
      handle.detach();
    };
  }, [eventBus]);

  // When stdin is not a TTY (piped by hive-cli start), skip interactive input
  const isInteractive = process.stdin.isTTY === true;

  // When the web dashboard is up, the rich TUI is duplicate work — the user
  // has the full UI in the browser. Trim the terminal down to a status pane
  // (URL, connection, fatal errors) so it stops fighting the dashboard for
  // attention. The --no-web path skips this and renders the rich TUI as
  // before.
  const webMode = webPort !== undefined && webServer.status === 'listening';

  const boxWidth = termWidth;

  const agentPrefix = `${agentName}:`;
  const visibleChatActivity = chatActivity.slice(-15);

  const hasAgent = !!runtime;
  const connectedDisplay = !hasAgent
    ? isStarting
      ? 'starting agent...'
      : 'no agent — open the dashboard to pick one'
    : connected
      ? 'Connected to zHive'
      : 'connecting...';
  const nameDisplay = hasAgent ? `${agentName} agent` : 'zhive';
  const headerFill = Math.max(0, boxWidth - nameDisplay.length - connectedDisplay.length - 12);

  return (
    <>
      {/* Settled poll activities — rendered once into scrollback, never
          re-rendered. Suppressed in web mode by passing an empty list so we
          don't double-log everything to the terminal that's already streaming
          to the dashboard. NOTE: <Static> must always be mounted — Ink's
          reconciler caches `rootNode.staticNode` and never clears it, so
          conditionally unmounting it leaves the renderer reading stale Yoga
          dimensions (a uint64 sentinel converts to ~3.7e19), and Output.get()
          tries to allocate that many rows → OOM in seconds. */}
      <Static items={webMode ? [] : settledPollActivities}>
        {(item, i) => {
          const formatted = activityFormatter.format(item);
          if (formatted.length === 0) return <Box key={`settled-${item.id ?? i}`} />;
          return <Text key={`settled-${item.id ?? i}`}>{formatted.join('\n')}</Text>;
        }}
      </Static>

      <Box flexDirection="column" width={boxWidth}>
        {/* Header */}
        <Box>
          <Text
            color={colors.honey}
          >{`${border.topLeft}${border.horizontal} ${symbols.hive} `}</Text>
          <Text color={colors.white} bold>
            {nameDisplay}
          </Text>
          <Text color={colors.gray}> {`${border.horizontal.repeat(3)} `}</Text>
          <Text color={hasAgent && connected ? colors.green : colors.honey}>
            {connectedDisplay}
          </Text>
          <Text color={colors.gray}>
            {' '}
            {border.horizontal.repeat(Math.max(0, headerFill))}
            {border.topRight}
          </Text>
        </Box>
        {hasAgent && modelInfo && (
          <Box paddingLeft={1}>
            <Text color={colors.gray}>{symbols.hive} </Text>
            <Text color={colors.cyan}>{modelInfo.modelId}</Text>
            <Text color={colors.gray}> {'×'} </Text>
            <Text color={colors.purple}>zData</Text>
          </Box>
        )}
        {hasAgent && connected && (
          <Box paddingLeft={1}>
            <Text color={colors.gray}>
              {symbols.hive} View all {agentName}'s activity at{' '}
            </Text>
            <Text color={colors.cyan}>
              {HIVE_FRONTEND_URL}/agent/{agentName}
            </Text>
          </Box>
        )}
        {webServer.status === 'listening' && (
          <Box paddingLeft={1}>
            <Text color={colors.gray}>{symbols.hive} Web dashboard: </Text>
            <Text color={colors.cyan}>{webServer.url}</Text>
          </Box>
        )}
        {webServer.status === 'error' && (
          <Box paddingLeft={1}>
            <Text color={colors.red}>
              {symbols.cross} Web dashboard failed to start: {webServer.error}
            </Text>
          </Box>
        )}

        <Box flexDirection="column" paddingLeft={1} paddingRight={1} minHeight={2}>
          {hasAgent && !connected && <Spinner label="Initiating neural link..." />}
          {!hasAgent && !isStarting && (
            <Text color={colors.gray}>
              {symbols.hive} waiting for agent selection in the web dashboard...
            </Text>
          )}
          {!hasAgent && isStarting && <Spinner label="Starting agent..." />}
          {/* Active poll activities suppressed in web mode — the dashboard's
              ActivityFeed renders the same events. */}
          {!webMode &&
            hasAgent &&
            activePollActivities.map((item, i) => {
              if (item.type !== 'megathread') {
                const formatted = activityFormatter.format(item);
                if (formatted.length === 0) return <Box key={`active-${item.id ?? i}`} />;
                return <Text key={`active-${item.id ?? i}`}>{formatted.join('\n')}</Text>;
              }
              return (
                <Box key={`active-${item.id ?? i}`} flexDirection="column">
                  <Box>
                    <Text color={colors.gray} dimColor>
                      {formatTime(item.timestamp)}{' '}
                    </Text>
                    <Text color={colors.controversial}>{symbols.hive} </Text>
                    <PollText
                      color={colors.controversial}
                      text={activityFormatter.getText(item)}
                      animate={false}
                    />
                    <Text> </Text>
                  </Box>
                  {activityFormatter.getDetail(item) && (
                    <Box marginLeft={13}>
                      <PollText
                        color={colors.gray}
                        text={`"${activityFormatter.getDetail(item)}"`}
                        animate={false}
                      />
                    </Box>
                  )}
                </Box>
              );
            })}
        </Box>

        {/* Overlay (e.g. /positions) - takes over chat area & input when active.
            Suppressed in web mode — overlays were terminal-only affordances
            for slash commands; the equivalent UI lives in the dashboard. */}
        {!webMode && hasAgent && overlay?.type === 'positions' && (
          <>
            <Box>
              <Text color={colors.gray}>
                {border.teeLeft}
                {`${border.horizontal.repeat(2)} positions `}
                {border.horizontal.repeat(Math.max(0, boxWidth - 14))}
                {border.teeRight}
              </Text>
            </Box>
            <PositionsView positions={overlay.positions} onClose={closeOverlay} />
          </>
        )}

        {!webMode && hasAgent && overlay?.type === 'watchlist' && (
          <>
            <Box>
              <Text color={colors.gray}>
                {border.teeLeft}
                {`${border.horizontal.repeat(2)} watchlist `}
                {border.horizontal.repeat(Math.max(0, boxWidth - 13))}
                {border.teeRight}
              </Text>
            </Box>
            <WatchlistView
              currentWatchlist={overlay.currentWatchlist}
              onClose={closeOverlay}
              onSaved={async () => reloadRuntime()}
            />
          </>
        )}

        {/* Chat section - visible after first message.
            Suppressed in web mode — the dashboard hosts chat. */}
        {!webMode && hasAgent && !overlay && (chatActivity.length > 0 || chatStreaming) && (
          <>
            <Box>
              <Text color={colors.gray}>
                {border.teeLeft}
                {`${border.horizontal.repeat(2)} chat with ${agentName} agent `}
                {border.horizontal.repeat(Math.max(0, boxWidth - agentName.length - 22))}
                {border.teeRight}
              </Text>
            </Box>
            <Box
              flexDirection="column"
              paddingLeft={1}
              paddingRight={1}
              minHeight={2}
              // @ts-expect-error maxHeight is supported by Ink at runtime but missing from types
              maxHeight={8}
            >
              {visibleChatActivity.map((item, i) => (
                <Box key={i}>
                  {item.type === 'chat-user' && (
                    <Box>
                      <Text color={colors.white} bold>
                        you:{' '}
                      </Text>
                      <Text color={colors.white}>{item.text}</Text>
                    </Box>
                  )}
                  {item.type === 'chat-agent' && (
                    <Box>
                      <Text color={colors.honey} bold>
                        {agentPrefix}
                      </Text>
                      <Text color={colors.white} wrap="wrap">
                        {item.text}
                      </Text>
                    </Box>
                  )}
                  {item.type === 'chat-error' && (
                    <Box>
                      <Text color={colors.red}>
                        {symbols.cross} {item.text}
                      </Text>
                    </Box>
                  )}
                  {(item.type === 'tool-summary' || item.type === 'tool-call') && (
                    <Box>
                      <Text>{item.text}</Text>
                    </Box>
                  )}
                </Box>
              ))}
              {chatStreaming && chatBuffer && (
                <Box>
                  <Text color={colors.honey} bold>
                    {agentPrefix}
                  </Text>
                  <Text color={colors.white} wrap="wrap">
                    {chatBuffer}
                  </Text>
                </Box>
              )}
            </Box>
          </>
        )}

        {/* Input Bar — only when stdin is a real TTY AND an agent is loaded.
            Suppressed in web mode — chat input lives in the dashboard. */}
        <Box>
          <Text color={colors.gray}>
            {!webMode && isInteractive && hasAgent ? border.teeLeft : border.bottomLeft}
            {border.horizontal.repeat(boxWidth - 2)}
            {!webMode && isInteractive && hasAgent ? border.teeRight : border.bottomRight}
          </Text>
        </Box>
        {!webMode && isInteractive && hasAgent && !overlay && (
          <>
            <Box paddingLeft={1}>
              <CommandInput
                value={input}
                onChange={setInput}
                onSubmit={(val) => {
                  setInput('');
                  void handleChatSubmit(val);
                }}
                placeholder={chatStreaming ? 'thinking...' : `chat with ${agentName} agent...`}
              />
            </Box>
            <Box>
              <Text color={colors.gray}>
                {border.bottomLeft}
                {border.horizontal.repeat(boxWidth - 2)}
                {border.bottomRight}
              </Text>
            </Box>
          </>
        )}
      </Box>
    </>
  );
};
