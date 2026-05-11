import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAgentPositions } from '../lib/api';
import {
  formatHoldTime,
  formatNotional,
  formatPrice,
  formatRoe,
  formatSize,
} from '../lib/format';
import type { PositionDirection, PositionEntry } from '../lib/types';

type SideFilter = 'all' | PositionDirection;

function symbolFromTokenId(tokenId: string): string {
  // Hyperliquid Mongo `token_id` is already a short symbol in practice;
  // strip "-PERP" if it sneaks in, then uppercase for display.
  return tokenId.replace(/-PERP$/i, '').toUpperCase();
}

function sideBadgeClass(side: PositionDirection): string {
  return side === 'long'
    ? 'border border-hive-bullish/40 bg-hive-bullish/10 text-hive-bullish'
    : 'border border-hive-bearish/40 bg-hive-bearish/10 text-hive-bearish';
}

function sideFilterClass(active: boolean, side: PositionDirection): string {
  if (side === 'long') {
    return active
      ? 'inline-flex items-center gap-1 border border-hive-bullish/40 bg-hive-bullish/10 px-1.5 py-0.5 text-hive-bullish'
      : 'inline-flex items-center gap-1 border border-transparent px-1.5 py-0.5 text-hive-bullish/80 hover:border-hive-bullish/20 hover:bg-hive-bullish/5 hover:text-hive-bullish';
  }
  return active
    ? 'inline-flex items-center gap-1 border border-hive-bearish/40 bg-hive-bearish/10 px-1.5 py-0.5 text-hive-bearish'
    : 'inline-flex items-center gap-1 border border-transparent px-1.5 py-0.5 text-hive-bearish/80 hover:border-hive-bearish/20 hover:bg-hive-bearish/5 hover:text-hive-bearish';
}

export function OpenPositionsCard() {
  const positionsQuery = useQuery({
    queryKey: ['agent-positions'],
    queryFn: fetchAgentPositions,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });

  const positions = positionsQuery.data?.entries ?? [];
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');

  const longCount = useMemo(
    () => positions.filter((p) => p.direction === 'long').length,
    [positions],
  );
  const shortCount = useMemo(
    () => positions.filter((p) => p.direction === 'short').length,
    [positions],
  );

  const filtered = useMemo(() => {
    if (sideFilter === 'all') return positions;
    return positions.filter((p) => p.direction === sideFilter);
  }, [positions, sideFilter]);

  // Book-level net unrealized — sums over all positions regardless of filter,
  // matching AgentOpenPositionsCard's "Net Unrealized doesn't change when
  // user toggles long/short" rule.
  const netUnrealized = useMemo(
    () => positions.reduce((sum, p) => sum + (p.unrealized_pnl ?? 0), 0),
    [positions],
  );
  const netPositive = netUnrealized >= 0;

  function toggleSide(next: PositionDirection): void {
    setSideFilter((cur) => (cur === next ? 'all' : next));
  }

  const emptyLabel =
    sideFilter === 'long'
      ? 'No long positions'
      : sideFilter === 'short'
        ? 'No short positions'
        : 'No open positions';

  return (
    <section className="border border-hive-border bg-hive-near-black">
      <div className="flex items-center justify-between border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          Open Positions
        </h2>
        <div className="flex items-center gap-1 font-mono text-[10px]">
          <button
            type="button"
            className={sideFilterClass(sideFilter === 'long', 'long')}
            onClick={() => toggleSide('long')}
            aria-pressed={sideFilter === 'long'}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full bg-hive-bullish ${
                sideFilter === 'long' ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <span>{longCount} L</span>
          </button>
          <span className="text-hive-text-dim">·</span>
          <button
            type="button"
            className={sideFilterClass(sideFilter === 'short', 'short')}
            onClick={() => toggleSide('short')}
            aria-pressed={sideFilter === 'short'}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full bg-hive-bearish ${
                sideFilter === 'short' ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <span>{shortCount} S</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center font-mono text-xs text-hive-text-dim">
            {positionsQuery.isLoading ? 'loading…' : emptyLabel}
          </p>
        ) : (
          filtered.map((p) => <PositionRow key={p.id} position={p} />)
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between border-t border-hive-border px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-hive-text-dim">
            Net Unrealized
          </span>
          <span
            className={`font-mono text-lg font-semibold tabular-nums ${
              netPositive ? 'text-hive-bullish' : 'text-hive-bearish'
            }`}
          >
            {formatNotional(netUnrealized)}
          </span>
        </div>
      )}
    </section>
  );
}

function PositionRow({ position: p }: { position: PositionEntry }) {
  const symbol = symbolFromTokenId(p.token_id);
  const sideAccent = p.direction === 'long' ? 'border-l-hive-bullish' : 'border-l-hive-bearish';
  const unrealized = p.unrealized_pnl ?? 0;
  const isPos = unrealized >= 0;
  const mark = p.current_price ?? p.avg_entry_price;
  const notional = p.size * p.avg_entry_price;
  const tp = typeof p.take_profit === 'number' ? p.take_profit : null;
  const sl = typeof p.stop_loss === 'number' ? p.stop_loss : null;
  const risk = sl !== null ? Math.abs(p.avg_entry_price - sl) : 0;
  const rr = tp !== null && sl !== null && risk > 0 ? Math.abs(tp - p.avg_entry_price) / risk : null;
  // `updated_at` doubles as `opened_at` for our purposes (matches what the
  // zhive-app frontend's `fetchAgentPositions` does — it just remaps the
  // backend's updated_at to opened_at).
  const holdMs = Date.now() - new Date(p.updated_at).getTime();

  return (
    <div
      className={`border border-l-2 border-hive-border/60 bg-white/[0.025] ${sideAccent}`}
    >
      <div className="flex items-center justify-between gap-3 px-3.5 pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-mono text-[13px] font-bold tracking-wider text-hive-text-primary">
            {symbol}
          </span>
          <span
            className={`px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${sideBadgeClass(
              p.direction,
            )}`}
          >
            {p.direction}
          </span>
          <span className="truncate font-mono text-[11px] text-hive-text-secondary">
            {formatSize(p.size)} {symbol}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 font-mono text-[11px]">
          <TpSlRrCell label="TP" value={tp !== null ? formatPrice(tp) : '—'} active={tp !== null} />
          <TpSlRrCell label="SL" value={sl !== null ? formatPrice(sl) : '—'} active={sl !== null} />
          <TpSlRrCell
            label="RR"
            value={rr !== null ? rr.toFixed(2) : '—'}
            active={rr !== null}
          />
        </div>
      </div>

      <div className="mt-2.5 px-3.5">
        <RangeBar side={p.direction} entry={p.avg_entry_price} mark={mark} tp={tp} sl={sl} />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] px-3.5 pb-3.5 pt-3">
        <div>
          <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-hive-text-dim">
            Unrealized
          </div>
          <div
            className={`font-mono text-lg font-semibold leading-none tabular-nums ${
              isPos ? 'text-hive-bullish' : 'text-hive-bearish'
            }`}
          >
            {formatNotional(unrealized)}
          </div>
          <div
            className={`mt-1 font-mono text-[11px] tabular-nums opacity-80 ${
              isPos ? 'text-hive-bullish' : 'text-hive-bearish'
            }`}
          >
            {p.pct_change !== null ? formatRoe(p.pct_change) : '—'}
          </div>
        </div>
        <Metric label="Value" value={`$${formatPrice(notional)}`} />
        <Metric label="Entry" value={formatPrice(p.avg_entry_price)} />
        <Metric label="Mark" value={formatPrice(mark)} />
        <Metric label="Hold" value={formatHoldTime(holdMs)} />
      </div>
    </div>
  );
}

function TpSlRrCell({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span className="tracking-[0.08em] text-hive-text-dim">{label}</span>
      <span
        className={`ml-0.5 tabular-nums ${active ? 'text-hive-text-primary' : 'text-hive-text-dim'}`}
      >
        {value}
      </span>
    </span>
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
  side: PositionDirection;
  entry: number;
  mark: number;
  tp: number | null;
  sl: number | null;
}

function RangeBar({ side, entry, mark, tp, sl }: RangeBarProps) {
  const HEIGHT = 4;
  const haveSL = sl !== null;
  const haveTP = tp !== null;

  let lo: number;
  let hi: number;
  if (haveSL && haveTP) {
    lo = Math.min(sl, tp);
    hi = Math.max(sl, tp);
  } else if (haveSL) {
    const mirror = entry + (entry - sl);
    lo = Math.min(sl, mirror);
    hi = Math.max(sl, mirror);
  } else if (haveTP) {
    const mirror = entry + (entry - tp);
    lo = Math.min(tp, mirror);
    hi = Math.max(tp, mirror);
  } else {
    lo = entry * 0.8;
    hi = entry * 1.2;
  }
  if (mark < lo) lo = mark - (hi - lo) * 0.05;
  if (mark > hi) hi = mark + (hi - lo) * 0.05;

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
        className={`absolute bottom-0 top-0 opacity-55 ${winColor}`}
        style={{ left: `${highlightLeft}%`, width: `${highlightWidth}%` }}
      />
      {haveSL ? (
        <Tick pos={frac(sl)} colorClass="bg-hive-bearish" height={HEIGHT} />
      ) : (
        <Tick pos={0} dashed height={HEIGHT} />
      )}
      {haveTP ? (
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

function Tick({
  pos,
  height,
  colorClass,
  dashed,
}: {
  pos: number;
  height: number;
  colorClass?: string;
  dashed?: boolean;
}) {
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
      className={`absolute ${colorClass}`}
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
