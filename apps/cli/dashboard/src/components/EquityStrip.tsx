import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAgentPortfolio } from '../lib/api';
import { formatPercent, formatUsd } from '../lib/format';
import type { AgentPortfolio, AgentTradingRank } from '../lib/types';

interface EquityStripProps {
  liveUnrealizedUsd: number;
  tradingRank: AgentTradingRank | null;
}

function todayKey(): string {
  // YYYY-MM-DD in local time — matches what the backend stores under
  // `daily_pnl[].date` for the current trading day.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function todaysRealized(portfolio: AgentPortfolio | undefined): number {
  if (!portfolio) return 0;
  const key = todayKey();
  const row = portfolio.daily_pnl.find((p) => p.date === key);
  return row?.realized_pnl_usd ?? 0;
}

export function EquityStrip({ liveUnrealizedUsd, tradingRank }: EquityStripProps) {
  const portfolioQuery = useQuery({
    queryKey: ['agent-portfolio', 'all'],
    queryFn: () => fetchAgentPortfolio('all'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const portfolio = portfolioQuery.data;
  const currentEquity = portfolio?.current_equity_usd ?? 0;
  const startingEquity = portfolio?.starting_equity_usd ?? 0;
  const realizedToday = useMemo(() => todaysRealized(portfolio), [portfolio]);
  // Realized all-time + ROI come from the leaderboard rank only.
  // `portfolio.all_time_pnl_usd` is NOT used as a fallback — it folds in
  // unrealized PnL (see AgentPortfolio type comment), which would make the
  // "realized" sub-line lie whenever the agent isn't yet on the leaderboard.
  const realizedAllTime = tradingRank?.total_pnl_usd ?? null;
  const roiPct = tradingRank?.roi_pct ?? null;

  const unrealizedPos = liveUnrealizedUsd >= 0;
  const todayPos = realizedToday >= 0;
  const allTimePos = (realizedAllTime ?? 0) >= 0;
  const roiPos = (roiPct ?? 0) >= 0;

  return (
    <div className="flex items-stretch gap-px bg-hive-border">
      <div className="flex-1 bg-hive-near-black px-6 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-hive-text-dim">
          Equity
        </div>
        <div
          className="mt-1 font-mono font-bold leading-none tabular-nums text-hive-text-primary"
          style={{ fontSize: 36 }}
        >
          {formatUsd(currentEquity)}
        </div>
        <div className="mt-2 font-mono text-[10px] text-hive-text-dim">
          start{' '}
          <span className="tabular-nums text-hive-text-secondary">{formatUsd(startingEquity)}</span>
        </div>
      </div>

      <div className="flex-1 bg-hive-near-black px-6 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-hive-text-dim">
          Realized · today
        </div>
        <div
          className={`mt-1 font-mono font-bold leading-none tabular-nums ${
            todayPos ? 'text-hive-bullish' : 'text-hive-bearish'
          }`}
          style={{ fontSize: 36 }}
        >
          {formatUsd(realizedToday, { signed: true })}
        </div>
        <div className="mt-2 font-mono text-[10px] text-hive-text-dim">
          unrealized{' '}
          <span
            className={`tabular-nums ${unrealizedPos ? 'text-hive-bullish' : 'text-hive-bearish'}`}
          >
            {formatUsd(liveUnrealizedUsd, { signed: true })}
          </span>
        </div>
      </div>

      <div className="flex-1 bg-hive-near-black px-6 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-hive-text-dim">
          Unrealized
        </div>
        <div
          className={`mt-1 font-mono font-bold leading-none tabular-nums ${
            unrealizedPos ? 'text-hive-bullish' : 'text-hive-bearish'
          }`}
          style={{ fontSize: 36 }}
        >
          {formatUsd(liveUnrealizedUsd, { signed: true })}
        </div>
        <div className="mt-2 font-mono text-[10px] text-hive-text-dim">
          realized all-time{' '}
          {realizedAllTime === null ? (
            <span className="tabular-nums text-hive-text-dim">—</span>
          ) : (
            <span
              className={`tabular-nums ${allTimePos ? 'text-hive-bullish' : 'text-hive-bearish'}`}
            >
              {formatUsd(realizedAllTime, { signed: true })}
            </span>
          )}{' '}
          · ROI{' '}
          {roiPct === null ? (
            <span className="tabular-nums text-hive-text-dim">—</span>
          ) : (
            <span className={`tabular-nums ${roiPos ? 'text-hive-bullish' : 'text-hive-bearish'}`}>
              {formatPercent(roiPct)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
