import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAgentClosedTrades } from '../lib/api';
import { formatHoldTime, formatPercent, formatPrice, formatUsd } from '../lib/format';
import type { ClosedTradeEntry, ClosedTradesTimeframe } from '../lib/types';
import { SymbolLink } from './primitives/SymbolLink';

const TIMEFRAMES: ClosedTradesTimeframe[] = ['24h', '7d', '30d', 'all'];

function formatClosedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) {
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${mo}/${day} ${hh}:${mm}`;
}

function quantityPrecision(value: number): number {
  const abs = Math.abs(value);
  if (abs >= 1) return 4;
  if (abs >= 0.01) return 6;
  return 8;
}

export function ClosedPositionsTable() {
  const [timeframe, setTimeframe] = useState<ClosedTradesTimeframe>('24h');

  const tradesQuery = useQuery({
    queryKey: ['agent-closed-trades', timeframe],
    queryFn: () => fetchAgentClosedTrades(timeframe),
    staleTime: 5_000,
    refetchInterval: 5_000,
    retry: false,
  });

  const entries = useMemo<ClosedTradeEntry[]>(() => {
    const raw = tradesQuery.data?.entries ?? [];
    return [...raw].sort(
      (a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime(),
    );
  }, [tradesQuery.data?.entries]);

  const netRealized = useMemo(() => entries.reduce((sum, e) => sum + e.realized_pnl, 0), [entries]);
  const netPositive = netRealized >= 0;

  const isLoading = tradesQuery.isLoading;
  const isError = tradesQuery.isError;
  const isEmpty = !isLoading && !isError && entries.length === 0;

  return (
    <section className="flex flex-col border-t border-hive-border bg-hive-near-black">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hive-border bg-hive-black px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-hive-text-dim">
          Closed positions · {entries.length}
        </span>
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map((t) => {
            const active = timeframe === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border transition-colors ${
                  active
                    ? 'text-hive-honey border-hive-honey/30 bg-hive-honey/10'
                    : 'text-hive-text-dim border-transparent hover:text-hive-text-primary'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {isError ? (
        <div className="px-4 py-10 text-center font-mono text-xs text-hive-bearish">
          Failed to load closed trades
        </div>
      ) : isLoading ? (
        <div className="px-4 py-10 text-center font-mono text-xs text-hive-text-dim">Loading…</div>
      ) : isEmpty ? (
        <div className="px-4 py-10 text-center font-mono text-xs text-hive-text-dim">
          No closed trades
        </div>
      ) : (
        <>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full font-mono text-[11px]">
              <thead className="sticky top-0 z-10 bg-hive-black">
                <tr className="border-b border-hive-border">
                  <Th>Time</Th>
                  <Th>Symbol</Th>
                  <Th>Side</Th>
                  <Th className="text-right">Size</Th>
                  <Th className="text-right">Value</Th>
                  <Th className="text-right">Entry</Th>
                  <Th className="text-right">Exit</Th>
                  <Th className="text-right">PnL</Th>
                  <Th className="text-right">ROE</Th>
                  <Th className="text-right">Hold</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <ClosedRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-hive-border px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-hive-text-dim">
              Net Realized
            </span>
            <span
              className={`font-mono text-sm font-bold tabular-nums ${
                netPositive ? 'text-hive-bullish' : 'text-hive-bearish'
              }`}
            >
              {formatUsd(netRealized, { signed: true })}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[9px] font-normal uppercase tracking-[0.22em] text-hive-text-dim ${className}`}
    >
      {children}
    </th>
  );
}

interface ClosedRowProps {
  entry: ClosedTradeEntry;
}

function ClosedRow({ entry }: ClosedRowProps) {
  const pos = entry.realized_pnl >= 0;
  const isLong = entry.direction === 'long';
  const value = entry.quantity * entry.entry_price;

  return (
    <tr className="border-b border-hive-border/40 hover:bg-hive-border/10 transition-colors">
      <td className="px-3 py-2 text-[10px] text-hive-text-dim tabular-nums">
        {formatClosedAt(entry.closed_at)}
      </td>
      <td className="px-3 py-2">
        <SymbolLink asset={entry.token_id} variant="badge" />
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${
            isLong ? 'text-hive-bullish bg-hive-bullish/10' : 'text-hive-bearish bg-hive-bearish/10'
          }`}
        >
          {entry.direction}
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-hive-text-secondary">
        {entry.quantity.toFixed(quantityPrecision(entry.quantity))}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-hive-text-secondary">
        {formatUsd(value)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-hive-text-secondary">
        {formatPrice(entry.entry_price)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-hive-text-secondary">
        {formatPrice(entry.exit_price)}
      </td>
      <td
        className={`px-3 py-2 text-right font-bold tabular-nums ${
          pos ? 'text-hive-bullish' : 'text-hive-bearish'
        }`}
      >
        {formatUsd(entry.realized_pnl, { signed: true })}
      </td>
      <td
        className={`px-3 py-2 text-right font-bold tabular-nums ${
          pos ? 'text-hive-bullish' : 'text-hive-bearish'
        }`}
      >
        {formatPercent(entry.roe_pct * 100)}
      </td>
      <td className="px-3 py-2 text-right text-[10px] text-hive-text-dim tabular-nums">
        {formatHoldTime(entry.hold_duration_ms)}
      </td>
    </tr>
  );
}
