import { formatPercent, formatUsd } from '../lib/format';
import type { DetailedPosition } from '../lib/types';

export type ValuedPosition = DetailedPosition & {
  livePnlUsd?: number;
  liveRoePercent?: number;
};

interface PositionsTableProps {
  positions: ValuedPosition[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Positions</h2>
        <span className="text-xs text-zinc-500">{positions.length}</span>
      </div>
      <div className="p-2">
        {positions.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-zinc-500">No open positions</p>
        )}
        {positions.map((p) => (
          <PositionRow key={`${p.coin}-${p.side}`} position={p} />
        ))}
      </div>
    </section>
  );
}

function PositionRow({ position: p }: { position: ValuedPosition }) {
  const pnl = p.livePnlUsd ?? p.unrealizedPnl;
  const roe = p.liveRoePercent ?? p.roePercent;
  const sideColor = p.side === 'long' ? 'text-emerald-400' : 'text-red-400';
  const pnlColor = pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-red-400' : 'text-zinc-400';

  return (
    <div className="flex items-baseline justify-between gap-2 rounded px-2 py-2 hover:bg-zinc-900">
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-zinc-100">{p.coin}</span>
          <span className={`text-xs font-medium uppercase ${sideColor}`}>{p.side}</span>
          <span className="text-xs text-zinc-500">{p.leverage}×</span>
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          entry {formatUsd(p.entryPrice)}
          {p.markPrice !== null && <> · mark {formatUsd(p.markPrice)}</>}
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className={`font-mono text-sm ${pnlColor}`}>{formatUsd(pnl, { signed: true })}</span>
        <span className={`mt-0.5 text-xs ${pnlColor}`}>{formatPercent(roe)}</span>
      </div>
    </div>
  );
}
