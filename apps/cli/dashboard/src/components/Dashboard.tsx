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
import { useEventStream } from '../lib/useEventStream';
import { useMids } from '../lib/useMids';
import { usePnl } from '../lib/usePnl';
import type { WebState } from '../lib/types';

interface DashboardProps {
  state: WebState;
  connected: boolean;
  onOpenSettings: () => void;
}

export function Dashboard({ state, connected, onOpenSettings }: DashboardProps) {
  const stream = useEventStream();

  const positions = state.positions;
  const coins = useMemo(
    () => Array.from(new Set([...positions.map((p) => p.coin), ...state.watchlist])),
    [positions, state.watchlist],
  );
  const { mids, status: wsStatus, tick } = useMids(coins);

  const pnl = usePnl(positions, mids, tick);

  const streamLive = !stream.isError;

  return (
    <div className="flex min-h-screen flex-col bg-hive-black">
      {/* Header stays pinned so the live PnL line is visible while the user
       * scrolls through activity history below. */}
      <div className="sticky top-0 z-10 bg-hive-black">
        <Header
          agentName={state.agentName}
          connected={connected}
          streamLive={streamLive}
          totalPnlUsd={pnl.totalPnlUsd}
          roePercent={pnl.roePercent}
          wsStatus={wsStatus}
          onOpenSettings={onOpenSettings}
        />
      </div>

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Center column — stacks vertically. No max-height; the page itself
         * scrolls. `min-w-0` is load-bearing: grid's default `1fr` is
         * `minmax(min-content, 1fr)`, which lets uPlot's ResizeObserver
         * feedback-loop the chart container infinitely wider. The explicit
         * `minmax(0,1fr)` on the parent + `min-w-0` here clamps it. */}
        <div className="flex min-w-0 flex-col gap-4">
          <RealizedPnlChart />
          <OpenPositionsCard />
          <ClosedTradesTable />
          <WatchlistPanel watchlist={state.watchlist} mids={mids} />
          <div className="flex min-h-[560px] min-w-0 flex-col">
            <ActivityFeed events={stream.events} />
          </div>
          <ChatPanel events={stream.events} agentName={state.agentName} />
        </div>

        {/* Right rail — sticky agent snapshot. Watchlist moved into the
         * center column so live-line widgets aren't fighting for the
         * narrower 320px lane. */}
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-104px)] lg:overflow-y-auto">
          <AgentInfoCard />
        </aside>
      </main>

      <div className="sticky bottom-0 z-10 bg-hive-black">
        <CommandBar />
      </div>
    </div>
  );
}
