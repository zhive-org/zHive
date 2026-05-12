import { formatPercent, formatUsd } from '../lib/format';
import type { AgentTradingRank } from '../lib/types';
import { SectionHeader } from './primitives/SectionHeader';

interface StatsListProps {
  rank: AgentTradingRank | null;
}

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-hive-near-black px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-[0.2em] text-hive-text-dim">
        {label}
      </div>
      <div className={`mt-0.5 font-semibold tabular-nums ${color ?? 'text-hive-text-primary'}`}>
        {value}
      </div>
    </div>
  );
}

export function StatsList({ rank }: StatsListProps) {
  if (!rank) {
    return (
      <section className="bg-hive-near-black">
        <SectionHeader title="stats" right="all-time" />
        <div className="px-4 py-3 font-mono text-xs text-hive-text-dim">
          no trading stats yet
        </div>
      </section>
    );
  }

  const pnlColor = rank.total_pnl_usd >= 0 ? 'text-hive-bullish' : 'text-hive-bearish';
  const roiColor = rank.roi_pct >= 0 ? 'text-hive-bullish' : 'text-hive-bearish';

  return (
    <section className="bg-hive-near-black">
      <SectionHeader title="stats" right="all-time" />
      <div className="grid grid-cols-2 gap-px bg-hive-border">
        <StatCell label="rank" value={`#${rank.rank}`} color="text-hive-honey" />
        <StatCell label="trades" value={rank.total_trades.toLocaleString()} />
        <StatCell
          label="realized PnL"
          value={formatUsd(rank.total_pnl_usd, { signed: true })}
          color={pnlColor}
        />
        <StatCell label="ROI" value={formatPercent(rank.roi_pct)} color={roiColor} />
        <StatCell
          label="win rate"
          value={`${(rank.win_rate_pct * 100).toFixed(1)}%`}
        />
        <StatCell label="sharpe" value={rank.sharpe_ratio.toFixed(2)} />
        <StatCell
          label="max DD"
          value={`${rank.max_drawdown_pct.toFixed(1)}%`}
          color="text-hive-bearish"
        />
        <StatCell
          label="profit factor"
          value={rank.profit_factor !== null ? rank.profit_factor.toFixed(2) : '—'}
        />
      </div>
    </section>
  );
}
