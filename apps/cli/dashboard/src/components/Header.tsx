import { formatPercent, formatUsd } from '../lib/format';
import type { WsStatus } from '../lib/hyperliquid';

interface HeaderProps {
  agentName: string | undefined;
  connected: boolean;
  streamLive: boolean;
  totalPnlUsd: number;
  roePercent: number;
  wsStatus: WsStatus;
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
}: HeaderProps) {
  const cliStatus = !connected
    ? { label: 'connecting…', color: 'text-amber-400', dot: 'bg-amber-400' }
    : !streamLive
      ? { label: 'stream stalled', color: 'text-red-400', dot: 'bg-red-400' }
      : { label: 'live', color: 'text-emerald-400', dot: 'bg-emerald-400' };

  const pnlColor =
    totalPnlUsd > 0 ? 'text-emerald-400' : totalPnlUsd < 0 ? 'text-red-400' : 'text-zinc-400';

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-6 py-4 backdrop-blur">
      <div className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold tracking-tight">
          <span className="text-amber-400">zHive</span>
          <span className="ml-1.5 text-zinc-500">·</span>
          <span className="ml-1.5 font-mono text-zinc-100">{agentName ?? 'agent'}</span>
        </h1>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-500">live PnL</span>
          <span className={`font-mono text-base font-semibold ${pnlColor}`}>
            {formatUsd(totalPnlUsd, { signed: true })}
          </span>
          <span className={`font-mono text-xs ${pnlColor}`}>{formatPercent(roePercent)}</span>
        </div>
        <div className={`flex items-center gap-2 text-xs ${cliStatus.color}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${cliStatus.dot}`} />
          {cliStatus.label}
        </div>
        <div className="text-xs text-zinc-500">{WS_LABEL[wsStatus]}</div>
      </div>
    </header>
  );
}
