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
  if (price < 1) return price.toFixed(6);
  return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function PriceTicker({ items }: PriceTickerProps) {
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
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-hive-border bg-hive-near-black">
      <div className="flex animate-ticker whitespace-nowrap py-1.5">
        {doubled.map((it, i) => (
          <div
            key={`${it.coin}-${i}`}
            className="mx-6 flex items-center gap-2 font-mono text-xs"
          >
            <span className="font-bold text-hive-text-primary">{it.coin}</span>
            <span className="tabular-nums text-hive-text-secondary">
              {formatTickerPrice(it.price)}
            </span>
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
        ))}
      </div>
    </div>
  );
}
