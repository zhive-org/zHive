import { useMemo } from 'react';
import { Header } from './Header';
import { AgentInfoCard } from './AgentInfoCard';
import { ActivityFeed } from './ActivityFeed';
import { ChatPanel } from './ChatPanel';
import { ClosedTradesTable } from './ClosedTradesTable';
import { CommandBar } from './CommandBar';
import { OpenPositionsCard } from './OpenPositionsCard';
import { WatchlistPanel } from './WatchlistPanel';
import { RealizedPnlChart } from './RealizedPnlChart';
import { TradingStatsStrip } from './TradingStatsStrip';
import { useEventStream } from '../lib/useEventStream';
import { useMids } from '../lib/useMids';
import { usePnl } from '../lib/usePnl';
import type { WebState } from '../lib/types';

interface DashboardProps {
  state: WebState;
  onOpenSettings: () => void;
}

export function Dashboard({ state, onOpenSettings }: DashboardProps) {
  const stream = useEventStream();

  const positions = state.positions;
  const coins = useMemo(
    () => Array.from(new Set([...positions.map((p) => p.coin), ...state.watchlist])),
    [positions, state.watchlist],
  );
  const { mids, tick } = useMids(coins);

  const pnl = usePnl(positions, mids, tick);

  return (
    <div className="flex min-h-screen flex-col bg-hive-black">
      {/* Header stays pinned so the live PnL line is visible while the user
       * scrolls through activity history below. */}
      <div className="sticky top-0 z-10 bg-hive-black">
        <Header
          agentName={state.agentName}
          totalPnlUsd={pnl.totalPnlUsd}
          roePercent={pnl.roePercent}
          onOpenSettings={onOpenSettings}
        />
      </div>

      {/* `pb-[300px]` leaves a runway so the last trade table / chat row
       * can scroll fully above the sticky bottom panel (240px activity +
       * ~48px CommandBar + buffer). Without it, the bottom edge of the
       * main content slips behind the panel and is unreachable. */}
      <main className="grid flex-1 grid-cols-1 gap-4 p-4 pb-[300px] lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Center column — stacks vertically. No max-height; the page itself
         * scrolls. `min-w-0` is load-bearing: grid's default `1fr` is
         * `minmax(min-content, 1fr)`, which lets uPlot's ResizeObserver
         * feedback-loop the chart container infinitely wider. The explicit
         * `minmax(0,1fr)` on the parent + `min-w-0` here clamps it. */}
        <div className="flex min-w-0 flex-col gap-4">
          <TradingStatsStrip />
          <RealizedPnlChart />
          <OpenPositionsCard />
          <ClosedTradesTable />
          <WatchlistPanel watchlist={state.watchlist} mids={mids} />
          <ChatPanel events={stream.events} agentName={state.agentName} />
        </div>

        {/* Right rail — sticky agent snapshot. Watchlist moved into the
         * center column so live-line widgets aren't fighting for the
         * narrower 320px lane. */}
        {/* Sticky-rail height accounts for: header (88px from top) + docked
         * bottom panel (~296px) + 16px buffer. Otherwise the rail's lower
         * portion gets hidden behind the activity panel during scroll. */}
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-400px)] lg:overflow-y-auto">
          <AgentInfoCard />
        </aside>
      </main>

      {/* Docked bottom panel: agent activity is the highest-priority
       * signal — pinning it here keeps the latest decisions visible
       * regardless of how far the user has scrolled into trade history.
       * The CommandBar sits below so the slash-command launcher is one
       * keystroke away even when the rest of the page is scrolled out. */}
      <div className="sticky bottom-0 z-10 flex flex-col border-t border-hive-border bg-hive-black">
        <div className="h-[240px] px-4 pt-3">
          <ActivityFeed events={stream.events} />
        </div>
        <CommandBar />
      </div>
    </div>
  );
}
