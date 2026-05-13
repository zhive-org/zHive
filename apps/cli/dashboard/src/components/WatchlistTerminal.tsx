import { memo, useEffect, useMemo, useRef } from 'react';
import { formatPercent, formatPrice } from '../lib/format';
import { SectionHeader } from './primitives/SectionHeader';
import { SymbolLink } from './primitives/SymbolLink';

interface WatchlistTerminalProps {
  watchlist: string[];
  mids: Map<string, number>;
  /** Optional 24h change percent keyed by symbol. */
  ch24?: Map<string, number>;
  /** Cap shown to 5 (design constraint). */
  maxRows?: number;
}

export function WatchlistTerminal({ watchlist, mids, ch24, maxRows = 5 }: WatchlistTerminalProps) {
  const visible = useMemo(() => watchlist.slice(0, maxRows), [watchlist, maxRows]);

  return (
    <section className="bg-hive-near-black">
      <SectionHeader
        title="watchlist"
        right={`${watchlist.length} ${watchlist.length === 1 ? 'asset' : 'assets'}`}
      />
      {visible.length === 0 ? (
        <p className="px-4 py-4 text-center font-mono text-xs text-hive-text-dim">Empty</p>
      ) : (
        <div className="divide-y divide-hive-border">
          {visible.map((coin) => (
            <WatchlistRow key={coin} coin={coin} price={mids.get(coin)} ch={ch24?.get(coin)} />
          ))}
        </div>
      )}
    </section>
  );
}

const WatchlistRow = memo(function WatchlistRow({
  coin,
  price,
  ch,
}: {
  coin: string;
  price: number | undefined;
  ch: number | undefined;
}) {
  const prevRef = useRef<number | undefined>(undefined);
  let tickColor = 'text-hive-text-secondary';
  if (price !== undefined && prevRef.current !== undefined && price !== prevRef.current) {
    tickColor = price > prevRef.current ? 'text-hive-bullish' : 'text-hive-bearish';
  }
  useEffect(() => {
    if (typeof price === 'number' && Number.isFinite(price)) {
      prevRef.current = price;
    }
  });

  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs hover:bg-hive-black">
      <SymbolLink asset={coin} variant="badge" />
      <div className="flex items-baseline gap-3 tabular-nums">
        <span className={tickColor}>{price == null ? '—' : `$${formatPrice(price)}`}</span>
        {typeof ch === 'number' && (
          <span
            className={`w-16 text-right ${ch >= 0 ? 'text-hive-bullish' : 'text-hive-bearish'}`}
          >
            {formatPercent(ch)}
          </span>
        )}
      </div>
    </div>
  );
});
