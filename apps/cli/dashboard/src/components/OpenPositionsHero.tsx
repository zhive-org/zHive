import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAgentPositions } from '../lib/api';
import { displaySymbol } from '../lib/coin';
import { formatHoldTime, formatPercent, formatPrice, formatUsd } from '../lib/format';
import type { PositionEntry } from '../lib/types';
import type { PnlSnapshot } from '../lib/usePnl';
import { SymbolLink } from './primitives/SymbolLink';

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

  const rows = useMemo(() => pnl.positionsValued.slice(0, maxRows), [pnl.positionsValued, maxRows]);

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

      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        {rows.length === 0 ? (
          <div className="px-2 py-8 text-center font-mono text-xs text-hive-text-dim">
            No open positions
          </div>
        ) : (
          rows.map((p) => (
            <HeroPosRow
              key={p.coin}
              coin={p.coin}
              side={p.side}
              size={p.size}
              leverage={p.leverage}
              entry={p.entryPrice}
              mark={p.markPrice ?? p.entryPrice}
              livePnlUsd={p.livePnlUsd}
              liveRoePercent={p.liveRoePercent}
              positionValueUsd={p.positionValueUsd}
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
  size: number;
  leverage: number;
  entry: number;
  mark: number;
  livePnlUsd: number;
  liveRoePercent: number;
  positionValueUsd: number;
  enrichment: PositionEntry | undefined;
}

function HeroPosRow({
  coin,
  side,
  size,
  leverage,
  entry,
  mark,
  livePnlUsd,
  liveRoePercent,
  positionValueUsd,
  enrichment,
}: HeroPosRowProps) {
  const tp =
    enrichment && typeof enrichment.take_profit === 'number' ? enrichment.take_profit : null;
  const sl = enrichment && typeof enrichment.stop_loss === 'number' ? enrichment.stop_loss : null;
  const heldMs = enrichment ? Date.now() - new Date(enrichment.updated_at).getTime() : 0;
  const isPos = livePnlUsd >= 0;
  const risk = sl !== null ? Math.abs(entry - sl) : 0;
  const rr = tp !== null && sl !== null && risk > 0 ? Math.abs(tp - entry) / risk : null;
  const sideAccent = side === 'long' ? 'border-l-hive-bullish' : 'border-l-hive-bearish';
  const sideTint = isPos ? 'bg-hive-bullish/[0.025]' : 'bg-hive-bearish/[0.025]';
  const sideBadgeClasses =
    side === 'long'
      ? 'border-hive-bullish/40 bg-hive-bullish/10 text-hive-bullish'
      : 'border-hive-bearish/40 bg-hive-bearish/10 text-hive-bearish';

  return (
    <div
      className={`border border-hive-border/60 border-l-2 ${sideAccent} ${sideTint} hover:bg-hive-black/40 transition-colors`}
    >
      <div className="flex items-center justify-between gap-3 px-3.5 pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SymbolLink asset={coin} variant="badge" />
          <span
            className={`inline-flex items-center border px-1 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${sideBadgeClasses}`}
          >
            {side === 'long' ? 'L' : 'S'} {leverage}x
          </span>
          <span className="truncate font-mono text-[11px] text-hive-text-secondary">
            {size.toLocaleString(undefined, { maximumFractionDigits: 4 })} {displaySymbol(coin)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1">
            <span className="tracking-[0.08em] text-hive-text-dim">TP</span>
            <span
              className={`ml-0.5 tabular-nums ${
                tp !== null ? 'text-hive-text-primary' : 'text-hive-text-dim'
              }`}
            >
              {tp !== null ? formatPrice(tp) : '—'}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="tracking-[0.08em] text-hive-text-dim">SL</span>
            <span
              className={`ml-0.5 tabular-nums ${
                sl !== null ? 'text-hive-text-primary' : 'text-hive-text-dim'
              }`}
            >
              {sl !== null ? formatPrice(sl) : '—'}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="tracking-[0.08em] text-hive-text-dim">RR</span>
            <span
              className={`ml-0.5 tabular-nums ${
                rr !== null ? 'text-hive-text-primary' : 'text-hive-text-dim'
              }`}
            >
              {rr !== null ? rr.toFixed(2) : '—'}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-2.5 px-3.5">
        <RangeBar side={side} entry={entry} mark={mark} tp={tp} sl={sl} />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] px-3.5 pt-3 pb-3.5">
        <div>
          <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-hive-text-dim">
            Unrealized
          </div>
          <div
            className={`font-mono text-lg font-semibold leading-none tabular-nums ${
              isPos ? 'text-hive-bullish' : 'text-hive-bearish'
            }`}
          >
            {formatUsd(livePnlUsd, { signed: true })}
          </div>
          <div
            className={`mt-1 font-mono text-[11px] tabular-nums opacity-80 ${
              isPos ? 'text-hive-bullish' : 'text-hive-bearish'
            }`}
          >
            {formatPercent(liveRoePercent)}
          </div>
        </div>
        <Metric label="Value" value={formatUsd(Math.abs(positionValueUsd))} />
        <Metric label="Entry" value={formatPrice(entry)} />
        <Metric label="Mark" value={formatPrice(mark)} />
        <Metric label="Hold" value={heldMs > 0 ? formatHoldTime(heldMs) : '—'} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-hive-text-dim">
        {label}
      </div>
      <div className="font-mono text-sm tabular-nums text-hive-text-primary">{value}</div>
    </div>
  );
}

interface RangeBarProps {
  side: 'long' | 'short';
  entry: number;
  mark: number;
  tp: number | null;
  sl: number | null;
}

function RangeBar({ side, entry, mark, tp, sl }: RangeBarProps) {
  const HEIGHT = 4;
  const { lo, hi } = trackRange(entry, mark, tp, sl);
  const range = hi - lo || 1;
  const frac = (v: number): number => Math.max(0, Math.min(1, (v - lo) / range)) * 100;
  const fEntry = frac(entry);
  const fMark = frac(mark);
  const winning = side === 'long' ? mark > entry : mark < entry;
  const winColor = winning ? 'bg-hive-bullish' : 'bg-hive-bearish';
  const highlightLeft = Math.min(fEntry, fMark);
  const highlightWidth = Math.abs(fMark - fEntry);

  return (
    <div className="relative w-full" style={{ height: HEIGHT }}>
      <div className="absolute inset-0 bg-white/[0.05]" />
      <div
        className={`absolute top-0 bottom-0 opacity-55 ${winColor}`}
        style={{ left: `${highlightLeft}%`, width: `${highlightWidth}%` }}
      />
      {sl !== null ? (
        <Tick pos={frac(sl)} colorClass="bg-hive-bearish" height={HEIGHT} />
      ) : (
        <Tick pos={0} dashed height={HEIGHT} />
      )}
      {tp !== null ? (
        <Tick pos={frac(tp)} colorClass="bg-hive-bullish" height={HEIGHT} />
      ) : (
        <Tick pos={100} dashed height={HEIGHT} />
      )}
      <Tick pos={fEntry} colorClass="bg-hive-text-secondary" height={HEIGHT} />
      <div
        className={`absolute h-2 w-2 ${winColor}`}
        style={{
          top: HEIGHT / 2,
          left: `${fMark}%`,
          transform: 'translate(-50%,-50%) rotate(45deg)',
          boxShadow: '0 0 0 2px #000',
        }}
      />
    </div>
  );
}

interface TickProps {
  pos: number;
  height: number;
  colorClass?: string;
  dashed?: boolean;
}

function Tick({ pos, height, colorClass, dashed }: TickProps) {
  if (dashed) {
    return (
      <div
        className="absolute"
        style={{
          top: -2,
          left: `${pos}%`,
          height: height + 4,
          transform: 'translateX(-50%)',
          borderLeft: '1.5px dashed rgba(242,242,242,0.3)',
        }}
      />
    );
  }
  return (
    <div
      className={`absolute ${colorClass ?? ''}`}
      style={{
        top: -2,
        left: `${pos}%`,
        width: 2,
        height: height + 4,
        transform: 'translateX(-50%)',
      }}
    />
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
