import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAgentPositions } from '../lib/api';
import { displaySymbol } from '../lib/coin';
import { formatHoldTime, formatPercent, formatPrice, formatUsd } from '../lib/format';
import type { PositionEntry } from '../lib/types';
import type { PnlSnapshot } from '../lib/usePnl';

interface OpenPositionsHeroProps {
  /** Canonical position list — always reflects what /api/state reports. The
   * runtime's snapshot is the source of truth here; /api/agent/positions is
   * used only to opportunistically enrich rows with TP/SL/hold-time. */
  pnl: PnlSnapshot;
  /** Cap shown to 5 (design constraint). */
  maxRows?: number;
}

function symbolFromTokenId(tokenId: string): string {
  return tokenId.replace(/-PERP$/i, '').toUpperCase();
}

export function OpenPositionsHero({ pnl, maxRows = 5 }: OpenPositionsHeroProps) {
  // Enrichment endpoint — TP/SL/hold-time live here. If it's unavailable
  // (503, empty, lagging), the rows still render from pnl.positionsValued.
  const positionsQuery = useQuery({
    queryKey: ['agent-positions'],
    queryFn: fetchAgentPositions,
    staleTime: 5_000,
    refetchInterval: 5_000,
    retry: false,
  });

  const enrichmentBySymbol = useMemo(() => {
    const out = new Map<string, PositionEntry>();
    for (const e of positionsQuery.data?.entries ?? []) {
      out.set(symbolFromTokenId(e.token_id), e);
    }
    return out;
  }, [positionsQuery.data?.entries]);

  const rows = useMemo(
    () => pnl.positionsValued.slice(0, maxRows),
    [pnl.positionsValued, maxRows],
  );

  const totalCount = pnl.positionsValued.length;
  const net = pnl.totalPnlUsd;
  const netPos = net >= 0;

  return (
    <div className="flex h-full flex-col bg-hive-near-black">
      <div className="flex items-center justify-between border-b border-hive-border px-6 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-hive-text-dim">
          Open positions · {totalCount}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-hive-text-dim">
            net unrealized
          </span>
          <span
            className={`font-mono text-base font-bold tabular-nums ${
              netPos ? 'text-hive-bullish' : 'text-hive-bearish'
            }`}
          >
            {formatUsd(net, { signed: true })}
          </span>
        </div>
      </div>

      <div className="flex-1 divide-y divide-hive-border">
        {rows.length === 0 ? (
          <div className="px-6 py-8 text-center font-mono text-xs text-hive-text-dim">
            No open positions
          </div>
        ) : (
          rows.map((p) => (
            <HeroPosRow
              key={p.coin}
              coin={p.coin}
              side={p.side}
              leverage={p.leverage}
              entry={p.entryPrice}
              mark={p.markPrice ?? p.entryPrice}
              livePnlUsd={p.livePnlUsd}
              liveRoePercent={p.liveRoePercent}
              enrichment={enrichmentBySymbol.get(displaySymbol(p.coin))}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface HeroPosRowProps {
  coin: string;
  side: 'long' | 'short';
  leverage: number;
  entry: number;
  mark: number;
  livePnlUsd: number;
  liveRoePercent: number;
  enrichment: PositionEntry | undefined;
}

function HeroPosRow({
  coin,
  side,
  leverage,
  entry,
  mark,
  livePnlUsd,
  liveRoePercent,
  enrichment,
}: HeroPosRowProps) {
  const symbol = displaySymbol(coin);
  const tp =
    enrichment && typeof enrichment.take_profit === 'number'
      ? enrichment.take_profit
      : null;
  const sl =
    enrichment && typeof enrichment.stop_loss === 'number'
      ? enrichment.stop_loss
      : null;
  const heldMs = enrichment
    ? Date.now() - new Date(enrichment.updated_at).getTime()
    : 0;
  const pos = livePnlUsd >= 0;

  const { lo, hi } = trackRange(entry, mark, tp, sl);
  const range = hi - lo || 1;
  const frac = (v: number): number =>
    Math.max(0, Math.min(1, (v - lo) / range)) * 100;

  return (
    <div className="px-6 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              side === 'long' ? 'bg-hive-bullish' : 'bg-hive-bearish'
            }`}
          />
          <span className="font-mono text-sm font-bold tracking-wider text-hive-text-primary">
            {symbol}
          </span>
          <span
            className={`font-mono text-[10px] uppercase tracking-wider ${
              side === 'long' ? 'text-hive-bullish' : 'text-hive-bearish'
            }`}
          >
            {side} {leverage}x
          </span>
          {heldMs > 0 && (
            <span className="font-mono text-[10px] text-hive-text-dim">
              {formatHoldTime(heldMs)}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] tabular-nums text-hive-text-dim">
            {formatPrice(mark)}
          </span>
          <span
            className={`font-mono text-sm font-semibold tabular-nums ${
              pos ? 'text-hive-bullish' : 'text-hive-bearish'
            }`}
          >
            {formatUsd(livePnlUsd, { signed: true })}
            <span className="ml-1.5 text-[10px] opacity-80">
              {formatPercent(liveRoePercent)}
            </span>
          </span>
        </div>
      </div>

      <div className="relative mt-1.5 h-1 bg-white/[0.04]">
        {sl !== null && (
          <div
            className="absolute inset-y-0 bg-hive-bearish/30"
            style={{ left: 0, width: `${frac(sl)}%` }}
          />
        )}
        {tp !== null && (
          <div
            className="absolute inset-y-0 bg-hive-bullish/30"
            style={{ left: `${frac(tp)}%`, right: 0 }}
          />
        )}
        <div
          className="absolute -top-0.5 h-2 w-0.5 bg-hive-text-secondary"
          style={{ left: `${frac(entry)}%` }}
        />
        <div
          className="absolute h-2 w-2 -translate-x-1/2 rotate-45 bg-hive-honey shadow-[0_0_0_2px_#0b0b0c]"
          style={{ left: `${frac(mark)}%`, top: '-2px' }}
        />
      </div>
    </div>
  );
}

function trackRange(
  entry: number,
  mark: number,
  tp: number | null,
  sl: number | null,
): { lo: number; hi: number } {
  if (tp !== null && sl !== null) {
    const lo = Math.min(tp, sl);
    const hi = Math.max(tp, sl);
    return clampToMark(lo, hi, mark);
  }
  if (sl !== null) {
    const mirror = entry + (entry - sl);
    return clampToMark(Math.min(sl, mirror), Math.max(sl, mirror), mark);
  }
  if (tp !== null) {
    const mirror = entry + (entry - tp);
    return clampToMark(Math.min(tp, mirror), Math.max(tp, mirror), mark);
  }
  return clampToMark(entry * 0.9, entry * 1.1, mark);
}

function clampToMark(lo: number, hi: number, mark: number): { lo: number; hi: number } {
  let l = lo;
  let h = hi;
  if (mark < l) l = mark - (h - l) * 0.05;
  if (mark > h) h = mark + (h - l) * 0.05;
  return { lo: l, hi: h };
}
