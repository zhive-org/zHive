import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAgentClosedTrades } from '../lib/api';
import { formatHoldTime, formatPercent, formatUsd } from '../lib/format';
import type { ClosedTradeEntry, ClosedTradesTimeframe } from '../lib/types';

const TIMEFRAMES: ClosedTradesTimeframe[] = ['24h', '7d', '30d', 'all'];

interface Stats {
  count: number;
  winRate: number | null;
  profitFactor: number | null;
  avgHoldMs: number | null;
  avgRoePct: number | null;
  best: ClosedTradeEntry | null;
  worst: ClosedTradeEntry | null;
}

function computeStats(trades: ClosedTradeEntry[]): Stats {
  if (trades.length === 0) {
    return {
      count: 0,
      winRate: null,
      profitFactor: null,
      avgHoldMs: null,
      avgRoePct: null,
      best: null,
      worst: null,
    };
  }
  let wins = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let holdSum = 0;
  let roeSum = 0;
  let best = trades[0];
  let worst = trades[0];
  for (const t of trades) {
    if (t.realized_pnl > 0) {
      wins += 1;
      grossProfit += t.realized_pnl;
    } else if (t.realized_pnl < 0) {
      grossLoss += -t.realized_pnl;
    }
    holdSum += t.hold_duration_ms;
    roeSum += t.roe_pct;
    if (t.realized_pnl > best.realized_pnl) best = t;
    if (t.realized_pnl < worst.realized_pnl) worst = t;
  }
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0;
  return {
    count: trades.length,
    winRate: wins / trades.length,
    profitFactor,
    avgHoldMs: holdSum / trades.length,
    avgRoePct: (roeSum / trades.length) * 100,
    best,
    worst,
  };
}

function formatProfitFactor(pf: number | null): string {
  if (pf === null) return '∞';
  if (!Number.isFinite(pf)) return '—';
  return pf.toFixed(2);
}

function pnlColor(value: number): string {
  if (value > 0) return 'text-hive-bullish';
  if (value < 0) return 'text-hive-bearish';
  return 'text-hive-text-secondary';
}

interface CellProps {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
}

function Cell({ label, value, valueClass, sub }: CellProps) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-0.5 px-3 py-2">
      <span className="font-mono text-[9px] uppercase tracking-wider text-hive-text-dim">
        {label}
      </span>
      <span className={`truncate font-mono text-sm font-bold text-hive-text-primary ${valueClass ?? ''}`}>
        {value}
      </span>
      {sub !== undefined && (
        <span className="truncate font-mono text-[10px] text-hive-text-dim">{sub}</span>
      )}
    </div>
  );
}

export function TradingStatsStrip() {
  const [timeframe, setTimeframe] = useState<ClosedTradesTimeframe>('all');

  const tradesQuery = useQuery({
    queryKey: ['agent-closed-trades', timeframe],
    queryFn: () => fetchAgentClosedTrades(timeframe),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const stats = useMemo(
    () => computeStats(tradesQuery.data?.entries ?? []),
    [tradesQuery.data?.entries],
  );

  const hasData = stats.count > 0;
  const winRateText = stats.winRate === null ? 'N/A' : `${(stats.winRate * 100).toFixed(1)}%`;
  const winRateClass =
    stats.winRate === null
      ? undefined
      : stats.winRate >= 0.5
        ? 'text-hive-bullish'
        : 'text-hive-bearish';

  return (
    <section className="border border-hive-border bg-hive-near-black">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          Trade Stats
        </h2>
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`border px-2 py-0.5 font-mono text-[10px] uppercase transition-colors ${
                timeframe === tf
                  ? 'border-hive-honey/40 bg-hive-honey/10 text-hive-honey'
                  : 'border-transparent text-hive-text-dim hover:text-hive-text-primary'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="flex min-h-16 items-center justify-center px-4 py-3">
          <span className="font-mono text-[10px] text-hive-text-dim">
            {tradesQuery.isLoading ? 'loading…' : 'no closed trades yet'}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-y divide-hive-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <Cell label="Trades" value={String(stats.count)} />
          <Cell label="Win Rate" value={winRateText} valueClass={winRateClass} />
          <Cell label="Profit Factor" value={formatProfitFactor(stats.profitFactor)} />
          <Cell
            label="Avg ROE"
            value={stats.avgRoePct === null ? 'N/A' : formatPercent(stats.avgRoePct)}
            valueClass={stats.avgRoePct === null ? undefined : pnlColor(stats.avgRoePct)}
          />
          <Cell
            label="Avg Hold"
            value={stats.avgHoldMs === null ? 'N/A' : formatHoldTime(stats.avgHoldMs)}
          />
          <Cell
            label="Best / Worst"
            value={
              stats.best && stats.worst
                ? `${formatUsd(stats.best.realized_pnl, { signed: true })} / ${formatUsd(stats.worst.realized_pnl, { signed: true })}`
                : 'N/A'
            }
            sub={
              stats.best && stats.worst
                ? `${stats.best.token_id.replace(/-PERP$/i, '')} / ${stats.worst.token_id.replace(/-PERP$/i, '')}`
                : undefined
            }
          />
        </div>
      )}
    </section>
  );
}
