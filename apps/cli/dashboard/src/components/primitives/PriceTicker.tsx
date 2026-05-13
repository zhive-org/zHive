import { memo, useEffect, useRef } from 'react';
import { SymbolLink } from './SymbolLink';

interface PriceTickerItem {
  coin: string;
  price: number | undefined;
  ch24?: number | null;
}

interface PriceTickerProps {
  items: PriceTickerItem[];
}

function formatTickerPrice(price: number | undefined): string {
  if (price == null || !Number.isFinite(price)) return '—';
  const digits = price < 1 ? 6 : 2;
  return `$${price.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function tickColor(price: number | undefined, prev: number | undefined): string {
  if (price === undefined || prev === undefined || price === prev) {
    return 'text-hive-text-secondary';
  }
  return price > prev ? 'text-hive-bullish' : 'text-hive-bearish';
}

function PriceTickerImpl({ items }: PriceTickerProps) {
  const prevPricesRef = useRef<Map<string, number>>(new Map());

  const directions = items.map((it) => tickColor(it.price, prevPricesRef.current.get(it.coin)));

  useEffect(() => {
    for (const it of items) {
      if (typeof it.price === 'number' && Number.isFinite(it.price)) {
        prevPricesRef.current.set(it.coin, it.price);
      }
    }
  });

  if (items.length === 0) {
    return (
      <div className="border-y border-hive-border bg-hive-near-black py-1.5">
        <span className="block px-6 font-mono text-xs text-hive-text-dim">
          watchlist empty — add tickers in settings
        </span>
      </div>
    );
  }

  // Duplicate items so the marquee never shows a blank gap — the keyframe
  // translates from 0 → -50%, then the duplicate snaps the cursor back to
  // the start without a visible reset.
  const doubled = items.concat(items);
  return (
    <div className="relative overflow-hidden border-y border-hive-border bg-hive-near-black">
      <div className="flex animate-ticker whitespace-nowrap py-1.5">
        {doubled.map((it, i) => {
          const color = directions[i % items.length];
          return (
            <div key={`${it.coin}-${i}`} className="mx-6 flex items-center gap-2 font-mono text-xs">
              <SymbolLink asset={it.coin} variant="inline" />
              <span className={`tabular-nums ${color}`}>{formatTickerPrice(it.price)}</span>
              {typeof it.ch24 === 'number' && (
                <span
                  className={`tabular-nums ${
                    it.ch24 >= 0 ? 'text-hive-bullish' : 'text-hive-bearish'
                  }`}
                >
                  {it.ch24 >= 0 ? '+' : ''}
                  {it.ch24.toFixed(2)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function arePropsEqual(prev: PriceTickerProps, next: PriceTickerProps): boolean {
  if (prev.items.length !== next.items.length) return false;
  for (let i = 0; i < prev.items.length; i++) {
    const a = prev.items[i];
    const b = next.items[i];
    if (a.coin !== b.coin) return false;
    if (formatTickerPrice(a.price) !== formatTickerPrice(b.price)) return false;
    const ach = typeof a.ch24 === 'number' ? Math.round(a.ch24 * 100) : null;
    const bch = typeof b.ch24 === 'number' ? Math.round(b.ch24 * 100) : null;
    if (ach !== bch) return false;
  }
  return true;
}

export const PriceTicker = memo(PriceTickerImpl, arePropsEqual);
