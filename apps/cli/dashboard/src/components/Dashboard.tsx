import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from './Header';
import { AgentCardCompact } from './AgentCardCompact';
import { ChatDrawer } from './ChatDrawer';
import { ClosedPositionsTable } from './ClosedPositionsTable';
import { EquityStrip } from './EquityStrip';
import { OpenPositionsHero } from './OpenPositionsHero';
import { StatsList } from './StatsList';
import { TerminalActivity } from './TerminalActivity';
import { WatchlistTerminal } from './WatchlistTerminal';
import { CountdownClock } from './primitives/CountdownClock';
import { PriceTicker } from './primitives/PriceTicker';
import { fetchAgentPortfolio, fetchAgentProfile } from '../lib/api';
import { normalizeCoinKey } from '../lib/coin';
import { useEventStream } from '../lib/useEventStream';
import { useMids } from '../lib/useMids';
import { usePnl } from '../lib/usePnl';
import type { StatusState } from './primitives/StatusPill';
import type { WebEvent, WebState } from '../lib/types';

interface DashboardProps {
  state: WebState;
  onOpenSettings: () => void;
}

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
/** Parse `"Sleeping {n}m until next cycle"` to recover the runtime's actual
 * interval. Falls back to 1h when no sleep message has been emitted yet. */
const SLEEP_PATTERN = /Sleeping\s+([0-9.]+)\s*m\s+until next cycle/i;

function deriveSchedule(events: WebEvent[]): {
  nextEvalAt: number | null;
  intervalMs: number;
} {
  let intervalMs = DEFAULT_INTERVAL_MS;
  let nextEvalAt: number | null = null;

  // Walk backwards — the most recent sleep message wins.
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'message') {
      const match = SLEEP_PATTERN.exec(e.text);
      if (match) {
        const minutes = Number(match[1]);
        if (Number.isFinite(minutes) && minutes > 0) {
          intervalMs = minutes * 60 * 1000;
          nextEvalAt = new Date(e.timestamp).getTime() + intervalMs;
          return { nextEvalAt, intervalMs };
        }
      }
    }
  }
  return { nextEvalAt, intervalMs };
}

function deriveStatus(events: WebEvent[]): StatusState {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'error') return 'error';
    if (e.type === 'analyzing') {
      return e.state === 'started' ? 'analyzing' : 'online';
    }
    if (e.type === 'online' || e.type === 'decision' || e.type === 'message') {
      return 'online';
    }
  }
  return 'idle';
}

export function Dashboard({ state, onOpenSettings }: DashboardProps) {
  const stream = useEventStream();

  // Shared queries — child components reuse the same cache keys, so
  // refetches dedupe automatically.
  const profileQuery = useQuery({
    queryKey: ['agent-profile'],
    queryFn: fetchAgentProfile,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const portfolioQuery = useQuery({
    queryKey: ['agent-portfolio', 'all'],
    queryFn: () => fetchAgentPortfolio('all'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const coins = useMemo(
    () =>
      // `useMids` subscribes to whatever coins it's given. The zhive adapter
      // hands us `"BTC-PERP"` shapes for positions; Hyperliquid's `allMids`
      // returns `"BTC"`. Normalize before subscribing so the resulting mids
      // map keys match what `usePnl` looks up.
      Array.from(
        new Set([
          ...state.positions.map((p) => normalizeCoinKey(p.coin)),
          ...state.watchlist.map(normalizeCoinKey),
        ]),
      ),
    [state.positions, state.watchlist],
  );
  const { mids, tick } = useMids(coins);
  const pnl = usePnl(state.positions, mids, tick);

  const status = useMemo(() => deriveStatus(stream.events), [stream.events]);
  const evaluating = status === 'analyzing';
  const { nextEvalAt, intervalMs } = useMemo(() => deriveSchedule(stream.events), [stream.events]);

  const tradingRank = profileQuery.data?.tradingRank ?? null;
  const currentEquityUsd = portfolioQuery.data?.current_equity_usd ?? 0;

  const tickerItems = useMemo(
    () => state.watchlist.map((coin) => ({ coin, price: mids.get(coin) })),
    // mids is a fresh Map every WS tick; depend on `tick` (a stable scalar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.watchlist, tick],
  );

  return (
    <div className="relative min-h-screen bg-hive-black font-mono text-hive-text-primary">
      <Header
        agentName={state.agentName}
        status={status}
        currentEquityUsd={currentEquityUsd}
        totalPnlUsd={pnl.totalPnlUsd}
        roePercent={pnl.roePercent}
        rank={tradingRank?.rank ?? null}
        onOpenSettings={onOpenSettings}
      />

      <PriceTicker items={tickerItems} />

      <EquityStrip liveUnrealizedUsd={pnl.totalPnlUsd} tradingRank={tradingRank} />

      <div className="grid grid-cols-[1fr_1.2fr] gap-px bg-hive-border">
        <div className="bg-hive-near-black px-7 py-7">
          <CountdownClock
            nextEvalAt={nextEvalAt}
            intervalMs={intervalMs}
            evaluating={evaluating}
            size="xl"
          />
        </div>
        <OpenPositionsHero pnl={pnl} maxRows={5} />
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-px bg-hive-border">
        <TerminalActivity events={stream.events} />
        <div className="flex flex-col gap-px bg-hive-border">
          <AgentCardCompact name={state.agentName} bio={state.bio} avatarUrl={state.avatarUrl} />
          <WatchlistTerminal watchlist={state.watchlist} mids={mids} maxRows={5} />
          <StatsList rank={tradingRank} />
        </div>
      </div>

      <ClosedPositionsTable />

      {/* Drawer space so the activity log isn't hidden behind the floating chat */}
      <div className="h-[88px]" />

      <ChatDrawer events={stream.events} agentName={state.agentName} />
    </div>
  );
}
