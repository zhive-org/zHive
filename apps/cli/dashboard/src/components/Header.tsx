import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exitAgent } from '../lib/api';
import { formatPercent, formatUsd } from '../lib/format';
import { StatusPill, type StatusState } from './primitives/StatusPill';

interface HeaderProps {
  agentName: string | undefined;
  status: StatusState;
  currentEquityUsd: number;
  totalPnlUsd: number;
  roePercent: number;
  rank: number | null;
  onOpenSettings: () => void;
  onOpenBacktest: () => void;
}

export function Header({
  agentName,
  status,
  currentEquityUsd,
  totalPnlUsd,
  roePercent,
  rank,
  onOpenSettings,
  onOpenBacktest,
}: HeaderProps) {
  const queryClient = useQueryClient();
  const exit = useMutation({
    mutationFn: exitAgent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['state'] });
    },
  });

  const pnlPos = totalPnlUsd >= 0;
  const pnlColor = pnlPos ? 'text-hive-bullish' : 'text-hive-bearish';

  return (
    <header className="flex items-center justify-between border-b border-hive-border bg-hive-near-black px-5 py-2.5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => exit.mutate()}
          disabled={exit.isPending}
          aria-label="change agent"
          title="change agent"
          className="border border-hive-border bg-hive-black px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← change
        </button>
        <span className="font-mono font-bold tracking-tight text-hive-honey">zHive</span>
        <span className="font-mono text-hive-text-dim">/</span>
        {agentName ? (
          <a
            href={`https://www.zhive.ai/agent/${encodeURIComponent(agentName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-hive-text-primary hover:text-hive-honey transition-colors"
          >
            {agentName}
          </a>
        ) : (
          <span className="font-mono text-hive-text-primary">agent</span>
        )}
        <StatusPill state={status} />
      </div>
      <div className="flex items-center gap-5 text-xs">
        <Stat label="EQUITY" value={formatUsd(currentEquityUsd)} />
        <Stat label="LIVE PnL" value={formatUsd(totalPnlUsd, { signed: true })} color={pnlColor} />
        <Stat label="ROE" value={formatPercent(roePercent)} color={pnlColor} />
        <Stat label="RANK" value={rank !== null ? `#${rank}` : '—'} color="text-hive-honey" />
        <button
          type="button"
          onClick={onOpenBacktest}
          className="border border-hive-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey"
        >
          ⏵ backtest
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="border border-hive-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey"
        >
          ⚙ settings
        </button>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  color = 'text-hive-text-primary',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-hive-text-dim">
        {label}
      </span>
      <span className={`font-mono font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
