import { useEffect, useRef, useState } from 'react';
import { AgentRuntime } from '../../../shared/agent/runtime';
import { ModelInfo, resolveModelInfo } from '../../../shared/config/ai-providers';
import { TradingAgent, TradingAgentCallbacks } from '../../../shared/trading/agent';
import { extractErrorMessage } from '../../../shared/utils';
import type { WebEventBus } from '../web/events';
import { PollActivityItem } from './types';
import { usePollActivity } from './usePollActivity';

export interface UseAgentState {
  connected: boolean;
  agentName: string;
  agentBio: string;
  modelInfo: ModelInfo | null;
  sectorsDisplay: string | null;
  timeframesDisplay: string | null;
  activePollActivities: PollActivityItem[];
  settledPollActivities: PollActivityItem[];
}

export function useAgent({
  runtime,
  eventBus,
}: {
  runtime?: AgentRuntime;
  eventBus?: WebEventBus;
}): UseAgentState {
  const [connected, setConnected] = useState(false);
  const [agentName, setAgentName] = useState('agent');
  const [agentBio, setAgentBio] = useState('');
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [sectorsDisplay, setSectorsDisplay] = useState<string | null>(null);
  const [timeframesDisplay, setTimeframesDisplay] = useState<string | null>(null);

  const agentRef = useRef<TradingAgent | null>(null);

  const { activePollActivities, settledPollActivities, addLog } = usePollActivity();

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
          const text = `Sleeping ${sleepMs / (1000 * 60)}m until next cycle`;
          const timestamp = new Date();
          addLog({ type: 'message', text, timestamp });
          eventBus?.push({ type: 'message', text }, timestamp);
        },
        onEvalStarted(assets) {
          const noun = assets.length === 1 ? 'asset' : 'assets';
          const names = assets.map((a) => a.replace(/^[a-z]+:/, '')).join(', ');
          const text = `Start analyzing ${assets.length} ${noun}: ${names}`;
          const timestamp = new Date();
          addLog({ type: 'message', text, timestamp });
          eventBus?.push({ type: 'message', text }, timestamp);
          eventBus?.push(
            { type: 'analyzing', state: 'started', assetCount: assets.length, assets },
            timestamp,
          );
        },
        onEvalReturned() {
          eventBus?.push({ type: 'analyzing', state: 'completed' }, new Date());
        },
        onBudgetAdjusted(msg) {
          const timestamp = new Date();
          addLog({ type: 'message', text: msg, timestamp });
          eventBus?.push({ type: 'message', text: msg }, timestamp);
        },
        onError(message) {
          const timestamp = new Date();
          addLog({ type: 'error', errorMessage: message, timestamp });
          eventBus?.push({ type: 'error', errorMessage: message }, timestamp);
          // Ensure the dashboard's thinking animation stops if the LLM call
          // errored out before onEvalReturned fired.
          eventBus?.push({ type: 'analyzing', state: 'completed' }, timestamp);
        },
        onEvalCompleted(decision) {
          // CLOSE doesn't carry a meaningful sizeUsd (decision schema has it
          // at 0 per the type doc); rendering "$0.00" misreads as no-op.
          const sizeUsd =
            decision.action === 'HOLD' || decision.action === 'CLOSE'
              ? undefined
              : decision.sizeUsd;
          const timestamp = new Date();
          addLog({
            type: 'decision',
            action: decision.action,
            asset: decision.asset,
            reasoning: decision.reasoning,
            sizeUsd,
            timestamp,
          });
          eventBus?.push(
            {
              type: 'decision',
              action: decision.action,
              asset: decision.asset,
              reasoning: decision.reasoning,
              sizeUsd,
              priceUsed: decision.priceUsed,
            },
            timestamp,
          );
        },
      };

      if (config.watchList.length === 0) {
        const errorMessage =
          'Watchlist is empty. Add assets to the watchlist in config.json and restart the agent.';
        const timestamp = new Date();
        addLog({ type: 'error', errorMessage, timestamp });
        eventBus?.push({ type: 'error', errorMessage }, timestamp);
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
        const timestamp = new Date();
        addLog({ type: 'online', name: config.name, bio, timestamp });
        eventBus?.push({ type: 'online', name: config.name, bio }, timestamp);
      }
    };

    start().catch((err) => {
      const raw = extractErrorMessage(err);
      const isNameTaken = raw.includes('409');
      const hint = isNameTaken ? ' Change the name in SOUL.md under "# Agent: <name>".' : '';
      const errorMessage = `Fatal: ${raw.slice(0, 120)}${hint}`;
      const timestamp = new Date();
      addLog({ type: 'error', errorMessage, timestamp });
      eventBus?.push({ type: 'error', errorMessage }, timestamp);
    });

    return () => {
      agentRef?.current?.stop();
    };
  }, [addLog, runtime, eventBus]);

  return {
    connected,
    agentName,
    agentBio,
    modelInfo,
    sectorsDisplay,
    timeframesDisplay,
    activePollActivities,
    settledPollActivities,
  };
}
