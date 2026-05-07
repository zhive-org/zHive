import { useMemo } from 'react';
import { Header } from './Header';
import { ActivityFeed } from './ActivityFeed';
import { ChatPanel } from './ChatPanel';
import { CommandBar } from './CommandBar';
import { PositionsTable } from './PositionsTable';
import { WatchlistPanel } from './WatchlistPanel';
import { RoeChart } from './RoeChart';
import { useEventStream } from '../lib/useEventStream';
import { useMids } from '../lib/useMids';
import { usePnl } from '../lib/usePnl';
import { useRoeSeries } from '../lib/useRoeSeries';
import type { WebState } from '../lib/types';

interface DashboardProps {
  state: WebState;
  connected: boolean;
}

export function Dashboard({ state, connected }: DashboardProps) {
  const stream = useEventStream();

  const positions = state.positions;
  const coins = useMemo(
    () => Array.from(new Set([...positions.map((p) => p.coin), ...state.watchlist])),
    [positions, state.watchlist],
  );
  const { mids, status: wsStatus, tick } = useMids(coins);

  const pnl = usePnl(positions, mids, tick);
  const series = useRoeSeries(pnl.roePercent);

  const streamLive = !stream.isError;

  return (
    <div className="flex h-screen flex-col bg-hive-black">
      <Header
        agentName={state.agentName}
        connected={connected}
        streamLive={streamLive}
        totalPnlUsd={pnl.totalPnlUsd}
        roePercent={pnl.roePercent}
        wsStatus={wsStatus}
      />
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <section className="shrink-0 border border-hive-border bg-hive-near-black">
            <div className="flex items-center justify-between border-b border-hive-border px-4 py-2">
              <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
                ROE Δ · 30s window
              </h2>
              <span className="font-mono text-xs text-hive-text-dim">
                {positions.length === 0 ? 'no open positions' : `${positions.length} pos.`}
              </span>
            </div>
            <RoeChart series={series} />
          </section>
          <ActivityFeed events={stream.events} />
          <ChatPanel events={stream.events} agentName={state.agentName} />
        </div>
        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <PositionsTable positions={pnl.positionsValued} mids={mids} />
          <WatchlistPanel watchlist={state.watchlist} mids={mids} />
        </aside>
      </main>
      <CommandBar />
    </div>
  );
}
