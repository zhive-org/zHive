import { formatPercent, formatUsd } from '../lib/format';
import type { DetailedPosition } from '../lib/types';
import { LivelineMiniChart } from './LivelineMiniChart';

export type ValuedPosition = DetailedPosition & {
  livePnlUsd?: number;
  liveRoePercent?: number;
};

interface PositionsTableProps {
  positions: ValuedPosition[];
  mids: Map<string, number>;
}

export function PositionsTable({ positions, mids }: PositionsTableProps) {
  return (
    <section className="border border-hive-border bg-hive-near-black">
      <div className="flex items-center justify-between border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          Positions
        </h2>
        <span className="font-mono text-xs text-hive-text-dim">{positions.length}</span>
      </div>
      <div className="p-2">
        {positions.length === 0 && (
          <p className="px-2 py-4 text-center font-mono text-sm text-hive-text-dim">
            No open positions
          </p>
        )}
        {positions.map((p) => (
          <PositionRow key={`${p.coin}-${p.side}`} position={p} livePrice={mids.get(p.coin)} />
        ))}
      </div>
    </section>
  );
}

function PositionRow({
  position: p,
  livePrice,
}: {
  position: ValuedPosition;
  livePrice: number | undefined;
}) {
  const pnl = p.livePnlUsd ?? p.unrealizedPnl;
  const roe = p.liveRoePercent ?? p.roePercent;
  const sideColor = p.side === 'long' ? 'text-hive-bullish' : 'text-hive-bearish';
  const pnlColor =
    pnl > 0 ? 'text-hive-bullish' : pnl < 0 ? 'text-hive-bearish' : 'text-hive-text-secondary';

  return (
    <div className="px-2 py-2 transition-colors hover:bg-hive-honey-dim">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold text-hive-text-primary">{p.coin}</span>
            <span className={`font-mono text-xs font-medium uppercase ${sideColor}`}>{p.side}</span>
            <span className="font-mono text-xs text-hive-text-dim">{p.leverage}×</span>
          </div>
          <div className="mt-0.5 font-mono text-xs text-hive-text-dim">
            entry {formatUsd(p.entryPrice)}
            {p.markPrice !== null && <> · mark {formatUsd(p.markPrice)}</>}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className={`font-mono text-sm ${pnlColor}`}>
            {formatUsd(pnl, { signed: true })}
          </span>
          <span className={`mt-0.5 font-mono text-xs ${pnlColor}`}>{formatPercent(roe)}</span>
        </div>
      </div>
      <div className="mt-1.5 h-8">
        <LivelineMiniChart symbol={p.coin} livePrice={livePrice} />
      </div>
    </div>
  );
}
