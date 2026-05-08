import { useQuery } from '@tanstack/react-query';
import { fetchAgentProfile } from '../lib/api';
import { formatPercent, formatUsd } from '../lib/format';
import type { AgentTradingRank } from '../lib/types';

function formatRoi(roiPct: number): string {
  // The upstream returns a percent value (e.g. 12.34 → "+12.34%").
  return formatPercent(roiPct);
}

function formatWinRate(winRatePct: number): string {
  // Upstream returns a 0–1 ratio. Convert to a percent for display.
  return `${(winRatePct * 100).toFixed(1)}%`;
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="font-mono text-xs uppercase tracking-wider text-hive-text-dim">
        {label}
      </span>
      <span className={`font-mono text-xs ${color ?? 'text-hive-text-primary'}`}>{value}</span>
    </div>
  );
}

function TradingStats({ rank }: { rank: AgentTradingRank }) {
  const pnlColor =
    rank.total_pnl_usd > 0
      ? 'text-hive-bullish'
      : rank.total_pnl_usd < 0
        ? 'text-hive-bearish'
        : 'text-hive-text-secondary';
  const roiColor =
    rank.roi_pct > 0
      ? 'text-hive-bullish'
      : rank.roi_pct < 0
        ? 'text-hive-bearish'
        : 'text-hive-text-secondary';

  return (
    <div className="flex flex-col gap-1.5">
      <StatRow label="rank" value={`#${rank.rank}`} color="text-hive-honey" />
      <StatRow label="trades" value={rank.total_trades.toLocaleString()} />
      <StatRow
        label="realized PnL"
        value={formatUsd(rank.total_pnl_usd, { signed: true })}
        color={pnlColor}
      />
      <StatRow label="ROI" value={formatRoi(rank.roi_pct)} color={roiColor} />
      <StatRow label="win rate" value={formatWinRate(rank.win_rate_pct)} />
    </div>
  );
}

export function AgentInfoCard() {
  const profileQuery = useQuery({
    queryKey: ['agent-profile'],
    queryFn: fetchAgentProfile,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const data = profileQuery.data;

  if (!data) {
    return (
      <section className="border border-hive-border bg-hive-near-black">
        <div className="border-b border-hive-border px-4 py-2">
          <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
            agent
          </h2>
        </div>
        <div className="px-4 py-3 font-mono text-xs text-hive-text-dim">
          {profileQuery.isError ? 'profile unavailable' : 'loading…'}
        </div>
      </section>
    );
  }

  return (
    <section className="border border-hive-border bg-hive-near-black">
      <div className="flex items-baseline justify-between border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          agent
        </h2>
        <a
          href={data.frontendUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-hive-honey hover:underline"
        >
          view on zhive.ai →
        </a>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex items-start gap-3">
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt=""
              className="h-12 w-12 shrink-0 border border-hive-border bg-hive-black object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-hive-border bg-hive-black font-mono text-lg text-hive-honey">
              {data.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-mono text-sm font-medium text-hive-text-primary">
              {data.name}
            </span>
            {data.bio && (
              <span className="font-mono text-xs leading-snug text-hive-text-dim">{data.bio}</span>
            )}
          </div>
        </div>

        {data.tradingRank ? (
          <div className="border-t border-hive-border pt-3">
            <TradingStats rank={data.tradingRank} />
          </div>
        ) : (
          <div className="border-t border-hive-border pt-3 font-mono text-xs text-hive-text-dim">
            no trading stats yet
          </div>
        )}
      </div>
    </section>
  );
}
