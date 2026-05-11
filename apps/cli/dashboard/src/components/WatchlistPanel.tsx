import { memo } from 'react';
import { LivelineMiniChart } from './LivelineMiniChart';
import { formatUsd } from '../lib/format';

interface WatchlistPanelProps {
  watchlist: string[];
  mids: Map<string, number>;
}

export function WatchlistPanel({ watchlist, mids }: WatchlistPanelProps) {
  return (
    <section className="border border-hive-border bg-hive-near-black">
      <div className="flex items-center justify-between border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          Watchlist
        </h2>
        <span className="font-mono text-xs text-hive-text-dim">{watchlist.length}</span>
      </div>
      {watchlist.length === 0 ? (
        <p className="px-4 py-4 text-center font-mono text-sm text-hive-text-dim">Empty</p>
      ) : (
        <div className="divide-y divide-hive-border">
          {watchlist.map((coin) => (
            <WatchlistRow key={coin} coin={coin} livePrice={mids.get(coin)} />
          ))}
        </div>
      )}
    </section>
  );
}

// Memoized at row granularity so a single coin's price tick doesn't
// re-render the rows for the OTHER coins. `mids` is a fresh `Map` on
// every WS tick — without per-row memo, `mids.get(coin)` returns the
// same number for unchanged coins but the row still re-renders because
// the parent did, cascading into Liveline.
const WatchlistRow = memo(function WatchlistRow({
  coin,
  livePrice,
}: {
  coin: string;
  livePrice: number | undefined;
}) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-hive-text-primary">{coin}</span>
        <span className="font-mono text-xs text-hive-text-secondary">
          {livePrice == null ? '—' : formatUsd(livePrice)}
        </span>
      </div>
      <div className="mt-1 h-8">
        <LivelineMiniChart symbol={coin} livePrice={livePrice} />
      </div>
    </div>
  );
});
