import type { ActiveRound } from '@zhive/sdk';
import { HiveAgent } from '@zhive/sdk';
import { useEffect, useRef, useState } from 'react';
import type { TokenUsage } from '../../../shared/agent/analysis.js';
import { extractErrorMessage } from '../../../shared/agent/utils.js';
import { ModelInfo, resolveModelInfo } from '../../../shared/config/ai-providers.js';
import { type AgentStats, fetchBulkStats } from '../../../shared/config/agent.js';
import { HIVE_API_URL } from '../../../shared/config/constant.js';
import { PollActivityItem } from './types.js';
import { usePollActivity } from './usePollActivity.js';
import { initializeAgentRuntime } from '../../../shared/agent/runtime.js';
import {
  createMegathreadRoundBatchHandler,
  createMegathreadRoundHandler,
  MegathreadReporter,
} from '../../../shared/agent/handler.js';

const STATS_POLL_INTERVAL_MS = 5 * 60 * 1_000;

export interface UseAgentState {
  connected: boolean;
  agentName: string;
  agentBio: string;
  modelInfo: ModelInfo | null;
  sectorsDisplay: string | null;
  timeframesDisplay: string | null;
  activePollActivities: PollActivityItem[];
  settledPollActivities: PollActivityItem[];
  predictionCount: number;
  termWidth: number;
  stats: AgentStats | null;
  statsUpdatedAt: Date | null;
}

export function useAgent(): UseAgentState {
  const [connected, setConnected] = useState(false);
  const [agentName, setAgentName] = useState('agent');
  const [agentBio, setAgentBio] = useState('');
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [sectorsDisplay, setSectorsDisplay] = useState<string | null>(null);
  const [timeframesDisplay, setTimeframesDisplay] = useState<string | null>(null);

  const [predictionCount, setPredictionCount] = useState(0);
  const [termWidth, setTermWidth] = useState(process.stdout.columns || 60);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<Date | null>(null);

  const agentRef = useRef<HiveAgent | null>(null);
  const recentPredictionsRef = useRef<string[]>([]);
  const predictionCountRef = useRef(0);

  const {
    activePollActivities,
    settledPollActivities,
    addLog,
    addMegathreadActivity,
    updateMegathreadActivity,
    finalizeMegathreadActivity,
  } = usePollActivity();

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

  // ─── Stats polling (every 5 min) ───────────────────

  useEffect(() => {
    if (!connected) return;

    const fetchStats = async (): Promise<void> => {
      const statsMap = await fetchBulkStats([agentName]);
      const agentStats = statsMap.get(agentName) ?? null;
      setStats(agentStats);
      if (agentStats) {
        setStatsUpdatedAt(new Date());
      }
    };

    void fetchStats();
    const timer = setInterval(() => void fetchStats(), STATS_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [connected, agentName]);

  // ─── Agent lifecycle ────────────────────────────────

  useEffect(() => {
    const start = async (): Promise<void> => {
      const runtime = await initializeAgentRuntime();
      const { config, memory, tools, skills } = runtime;

      setAgentName(config.name);
      setAgentBio(config.bio ?? '');

      const resolvedModelInfo = resolveModelInfo();
      setModelInfo(resolvedModelInfo);

      const tuiReporter: MegathreadReporter = {
        onRoundStart(round: ActiveRound, timeframe: string): void {
          addMegathreadActivity({
            id: round.roundId,
            type: 'megathread',
            projectId: round.projectId,
            timeframe,
            timestamp: new Date(),
            status: 'analyzing',
          });
        },
        onPriceInfo(
          round: ActiveRound,
          priceAtStart: number,
          currentPrice?: number,
          timeLeftMs?: number,
        ): void {
          updateMegathreadActivity(round.roundId, {
            priceAtStart,
            currentPrice,
            timeLeftMs,
          });
        },
        onResearching(): void {
          // TUI status is already 'analyzing' from onRoundStart
        },
        onScreenStart() {
          addLog({
            type: 'message',
            text: `Screening megathread round to engage`,
            timestamp: new Date(),
          });
        },

        onScreenResult(engagingRounds: ActiveRound[], totalRound: number): void {
          addLog({
            type: 'message',
            text: `Screen completed, Processing ${engagingRounds.length} rounds out of total ${totalRound} rounds`,
            timestamp: new Date(),
          });
        },
        onToolsUsed(): void {
          // TUI does not display tool usage inline
        },
        onPosted(
          round: ActiveRound,
          conviction: number,
          summary: string,
          _timeframe: string,
          usage: TokenUsage,
        ): void {
          const sign = conviction >= 0 ? '+' : '';
          finalizeMegathreadActivity(round.roundId, {
            status: 'posted',
            conviction,
            summary,
            tokenUsage: usage,
          });

          predictionCountRef.current += 1;
          setPredictionCount(predictionCountRef.current);

          const predSummary = `[${sign}${conviction.toFixed(2)}%] ${summary}`;
          recentPredictionsRef.current = [predSummary, ...recentPredictionsRef.current].slice(0, 5);
        },
        onError(round: ActiveRound, message: string): void {
          finalizeMegathreadActivity(round.roundId, { status: 'error', errorMessage: message });
        },
      };

      // eslint-disable-next-line prefer-const
      let agent: HiveAgent;
      const roundHandler = createMegathreadRoundHandler(() => agent, runtime, tuiReporter);
      const batchHandler = createMegathreadRoundBatchHandler(() => agent, runtime, tuiReporter, {
        maxConcurrency: 1,
      });

      agent = new HiveAgent(HIVE_API_URL, {
        name: config.name,
        avatarUrl: config.avatarUrl,
        bio: config.bio ?? undefined,
        agentProfile: config.agentProfile,
        onPollEmpty: () => {
          addLog({
            type: 'message',
            text: 'Polled but no new rounds',
            timestamp: new Date(),
          });
        },
        onNewMegathreadRound: roundHandler,
        onNewMegathreadRounds: batchHandler,
        megathreadHandlerBatchSize: 100,
      });

      agentRef.current = agent;
      await agent.start();
      setConnected(true);

      const { agentProfile } = config;
      const resolvedSectors =
        agentProfile.sectors.length > 0 ? agentProfile.sectors.join(', ') : 'all';
      const resolvedTimeframes = agentProfile.timeframes.join(', ');
      setSectorsDisplay(resolvedSectors);
      setTimeframesDisplay(resolvedTimeframes);

      const bio = config.bio ?? '';
      if (bio) {
        addLog({
          type: 'online',
          name: config.name,
          bio,
          timestamp: new Date(),
        });
      }
    };

    start().catch((err) => {
      const raw = extractErrorMessage(err);
      const isNameTaken = raw.includes('409');
      const hint = isNameTaken ? ' Change the name in SOUL.md under "# Agent: <name>".' : '';
      addLog({
        type: 'error',
        errorMessage: `Fatal: ${raw.slice(0, 120)}${hint}`,
        timestamp: new Date(),
      });
    });

    return () => {
      agentRef.current?.stop().catch(() => {});
    };
  }, []);

  return {
    connected,
    agentName,
    agentBio,
    modelInfo,
    sectorsDisplay,
    timeframesDisplay,
    activePollActivities,
    settledPollActivities,
    predictionCount,
    termWidth,
    stats,
    statsUpdatedAt,
  };
}
