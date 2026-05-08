import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exitAgent } from '../lib/api';
import { formatPercent, formatUsd } from '../lib/format';
import type { WsStatus } from '../lib/hyperliquid';

interface HeaderProps {
  agentName: string | undefined;
  connected: boolean;
  streamLive: boolean;
  totalPnlUsd: number;
  roePercent: number;
  wsStatus: WsStatus;
  onOpenSettings: () => void;
}

const WS_LABEL: Record<WsStatus, string> = {
  connecting: 'mids: connecting',
  live: 'mids: live',
  stalled: 'mids: stalled',
  reconnecting: 'mids: reconnecting',
};

export function Header({
  agentName,
  connected,
  streamLive,
  totalPnlUsd,
  roePercent,
  wsStatus,
  onOpenSettings,
}: HeaderProps) {
  // Click → return to picker. While in the dashboard, /api/state polls
  // every 30s, so without an explicit invalidate the SPA would sit on the
  // stale "ready" snapshot for up to half a minute before re-polling and
  // seeing phase: 'selecting'. Invalidating on success forces an immediate
  // refetch — the picker shows up within ~one round-trip.
  const queryClient = useQueryClient();
  const exit = useMutation({
    mutationFn: exitAgent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['state'] });
    },
  });

  const cliStatus = !connected
    ? { label: 'connecting…', color: 'text-hive-pending', dot: 'bg-hive-pending' }
    : !streamLive
      ? { label: 'stream stalled', color: 'text-hive-bearish', dot: 'bg-hive-bearish' }
      : { label: 'live', color: 'text-hive-bullish', dot: 'bg-hive-bullish' };

  const pnlColor =
    totalPnlUsd > 0
      ? 'text-hive-bullish'
      : totalPnlUsd < 0
        ? 'text-hive-bearish'
        : 'text-hive-text-secondary';

  return (
    <header className="flex items-center justify-between border-b border-hive-border bg-hive-near-black px-6 py-4">
      <div className="flex items-baseline gap-3">
        <button
          type="button"
          onClick={() => exit.mutate()}
          disabled={exit.isPending}
          aria-label="change agent"
          title="change agent"
          className="self-center border border-hive-border bg-hive-black px-2 py-1 font-mono text-xs text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← change agent
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="settings"
          title="settings"
          className="self-center border border-hive-border bg-hive-black px-2 py-1 font-mono text-xs text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey"
        >
          ⚙ settings
        </button>
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-hive-honey">zHive</span>
          <span className="ml-1.5 text-hive-text-dim">·</span>
          <span className="ml-1.5 font-mono text-hive-text-primary">{agentName ?? 'agent'}</span>
        </h1>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-hive-text-dim">
            live PnL
          </span>
          <span className={`font-mono text-base font-semibold ${pnlColor}`}>
            {formatUsd(totalPnlUsd, { signed: true })}
          </span>
          <span className={`font-mono text-xs ${pnlColor}`}>{formatPercent(roePercent)}</span>
        </div>
        <div className={`flex items-center gap-2 font-mono text-xs ${cliStatus.color}`}>
          <span className={`inline-block h-2 w-2 ${cliStatus.dot}`} />
          {cliStatus.label}
        </div>
        <div className="font-mono text-xs text-hive-text-dim">{WS_LABEL[wsStatus]}</div>
      </div>
    </header>
  );
}
