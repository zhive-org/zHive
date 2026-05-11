import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAgentClosedTrades } from '../lib/api';
import {
  formatHoldTime,
  formatNotional,
  formatPrice,
  formatRelativeTime,
  formatRoe,
  formatSize,
} from '../lib/format';
import type { ClosedTradeEntry, ClosedTradesTimeframe } from '../lib/types';

const TIMEFRAMES: ClosedTradesTimeframe[] = ['24h', '7d', '30d', 'all'];

const COLUMNS: { label: string }[] = [
  { label: 'Time' },
  { label: 'Symbol' },
  { label: 'Side' },
  { label: 'Size' },
  { label: 'Value' },
  { label: 'Entry' },
  { label: 'Exit' },
  { label: 'PnL' },
  { label: 'ROE' },
  { label: 'Hold' },
  { label: '' },
];
const COL_COUNT = COLUMNS.length;

function symbolFromTokenId(tokenId: string): string {
  return tokenId.replace(/-PERP$/i, '').toUpperCase();
}

export function ClosedTradesTable() {
  const [timeframe, setTimeframe] = useState<ClosedTradesTimeframe>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tradesQuery = useQuery({
    queryKey: ['agent-closed-trades', timeframe],
    queryFn: () => fetchAgentClosedTrades(timeframe),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const trades = tradesQuery.data?.entries ?? [];
  const isLoading = tradesQuery.isLoading;
  const isEmpty = !isLoading && trades.length === 0;

  function toggleExpanded(id: string): void {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  return (
    <section className="border border-hive-border bg-hive-near-black">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          Closed Positions
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

      {isLoading || isEmpty ? (
        <div className="flex min-h-24 items-center justify-center">
          <span className="font-mono text-[10px] text-hive-text-dim">
            {isLoading ? 'Loading…' : 'No trades found'}
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-hive-border">
                {COLUMNS.map((col, i) => (
                  <th
                    key={col.label || `col-${i}`}
                    aria-label={col.label || 'Reasoning'}
                    className="px-2 py-2 text-left text-[9px] font-normal uppercase tracking-wider text-hive-text-dim"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  expanded={expandedId === trade.id}
                  onToggle={() => toggleExpanded(trade.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TradeRow({
  trade,
  expanded,
  onToggle,
}: {
  trade: ClosedTradeEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isPos = trade.realized_pnl >= 0;
  const symbol = symbolFromTokenId(trade.token_id);
  const hasReasoning = Boolean(trade.open_reasoning || trade.close_reasoning);
  const sideBadge =
    trade.direction === 'long'
      ? 'border border-hive-bullish/40 bg-hive-bullish/10 text-hive-bullish'
      : 'border border-hive-bearish/40 bg-hive-bearish/10 text-hive-bearish';

  return (
    <Fragment>
      <tr className="border-b border-hive-border/30 transition-colors hover:bg-hive-border/10">
        <td className="px-2 py-2 text-[10px] text-hive-text-dim">
          {formatRelativeTime(trade.closed_at)}
        </td>
        <td className="px-2 py-2 text-hive-text-primary">{symbol}</td>
        <td className="px-2 py-2">
          <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${sideBadge}`}>
            {trade.direction}
          </span>
        </td>
        <td className="px-2 py-2 text-hive-text-secondary">{formatSize(trade.quantity)}</td>
        <td className="px-2 py-2 text-hive-text-secondary">
          {formatPrice(trade.quantity * trade.entry_price)}
        </td>
        <td className="px-2 py-2 text-hive-text-secondary">{formatPrice(trade.entry_price)}</td>
        <td className="px-2 py-2 text-hive-text-secondary">{formatPrice(trade.exit_price)}</td>
        <td
          className={`px-2 py-2 text-sm font-bold ${
            isPos ? 'bg-hive-bullish/5 text-hive-bullish' : 'bg-hive-bearish/5 text-hive-bearish'
          }`}
        >
          {formatNotional(trade.realized_pnl)}
        </td>
        <td
          className={`px-2 py-2 font-bold ${isPos ? 'text-hive-bullish' : 'text-hive-bearish'}`}
        >
          {formatRoe(trade.roe_pct)}
        </td>
        <td className="px-2 py-2 text-hive-text-dim">{formatHoldTime(trade.hold_duration_ms)}</td>
        <td className="px-2 py-2 text-right">
          {hasReasoning ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase transition-colors ${
                expanded
                  ? 'border-hive-honey/30 bg-hive-honey/10 text-hive-honey'
                  : 'border-hive-border text-hive-text-dim hover:border-hive-honey/30 hover:text-hive-honey'
              }`}
            >
              {expanded ? 'hide' : 'why'}
            </button>
          ) : null}
        </td>
      </tr>
      {expanded && hasReasoning ? (
        <tr className="border-b border-hive-border/30 bg-hive-border/5">
          <td colSpan={COL_COUNT} className="px-4 py-3">
            <div className="flex flex-col gap-2 font-mono text-[11px] text-hive-text-secondary">
              {trade.open_reasoning ? (
                <div>
                  <span className="mr-2 text-[9px] uppercase tracking-[0.14em] text-hive-text-dim">
                    open
                  </span>
                  {trade.open_reasoning}
                </div>
              ) : null}
              {trade.close_reasoning ? (
                <div>
                  <span className="mr-2 text-[9px] uppercase tracking-[0.14em] text-hive-text-dim">
                    close
                  </span>
                  {trade.close_reasoning}
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
