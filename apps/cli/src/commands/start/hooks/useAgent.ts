import { useEffect, useRef, useState } from 'react';
import { AgentRuntime, initializeAgentRuntime } from '../../../shared/agent/runtime';
import { extractErrorMessage } from '../../../shared/megathread/utils';
import { type AgentStats, fetchBulkStats } from '../../../shared/config/agent';
import { ModelInfo, resolveModelInfo } from '../../../shared/config/ai-providers';
import { TradingAgent, TradingAgentCallbacks } from '../../../shared/trading/agent';
import { PollActivityItem } from './types';
import { usePollActivity } from './usePollActivity';
import { useAgentRuntime } from './useAgentRuntime';

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
  termWidth: number;
  stats: AgentStats | null;
  statsUpdatedAt: Date | null;
}

export function useAgent({ runtime }: { runtime?: AgentRuntime }): UseAgentState {
  const [connected, setConnected] = useState(false);
  const [agentName, setAgentName] = useState('agent');
  const [agentBio, setAgentBio] = useState('');
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [sectorsDisplay, setSectorsDisplay] = useState<string | null>(null);
  const [timeframesDisplay, setTimeframesDisplay] = useState<string | null>(null);

  const [termWidth, setTermWidth] = useState(process.stdout.columns || 60);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<Date | null>(null);

  const agentRef = useRef<TradingAgent | null>(null);

  const { activePollActivities, settledPollActivities, addLog } = usePollActivity();

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
    if (!runtime) {
      return;
    }

    const start = async (): Promise<void> => {
      const { config } = runtime;
      setAgentName(config.name);
      setAgentBio(config.bio ?? '');

      const resolvedModelInfo = resolveModelInfo();
      setModelInfo(resolvedModelInfo);

      const callbacks: TradingAgentCallbacks = {
        onSleep(sleepMs) {
          addLog({
            type: 'message',
            text: `Sleeping ${sleepMs / (1000 * 60)}m until next cycle`,
            timestamp: new Date(),
          });
        },
        onEvalStarted(assets) {
          addLog({
            type: 'message',
            text: `Start analyzing ${assets.length} assets`,
            timestamp: new Date(),
          });
        },
        onError(message) {
          addLog({
            type: 'error',
            errorMessage: message,
            timestamp: new Date(),
          });
        },
        onEvalCompleted(decision) {
          addLog({
            type: 'decision',
            action: decision.action,
            asset: decision.asset,
            reasoning: decision.reasoning,
            sizeUsd: decision.action === 'HOLD' ? undefined : decision.sizeUsd,
            timestamp: new Date(),
          });
        },
      };

      if (config.watchList.length === 0) {
        addLog({
          type: 'error',
          errorMessage:
            'Watchlist is empty. Add assets to the watchlist in config.json and restart the agent.',
          timestamp: new Date(),
        });
        return;
      }

      const agent = await TradingAgent.create(config.watchList, runtime, callbacks);
      agentRef.current = agent;

      await agent.run();
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
      agentRef?.current?.stop();
    };
  }, [addLog, runtime]);

  return {
    connected,
    agentName,
    agentBio,
    modelInfo,
    sectorsDisplay,
    timeframesDisplay,
    activePollActivities,
    settledPollActivities,
    termWidth,
    stats,
    statsUpdatedAt,
  };
}
