import type { AccountSnapshot } from '../lib/types';
import { formatUsd } from '../lib/format';

interface BacktestEquityCurveProps {
  snapshots: AccountSnapshot[];
}

const VIEW_W = 600;
const VIEW_H = 160;
const PAD_X = 8;
const PAD_Y = 12;

export function BacktestEquityCurve({ snapshots }: BacktestEquityCurveProps) {
  if (snapshots.length < 2) {
    return (
      <div className="px-4 py-6 text-center font-mono text-xs text-hive-text-dim">
        Not enough data for an equity curve
      </div>
    );
  }

  const firstTs = snapshots[0]!.ts;
  const lastTs = snapshots[snapshots.length - 1]!.ts;
  const initialEquity = snapshots[0]!.equity;

  let minEquity = Infinity;
  let maxEquity = -Infinity;
  for (const s of snapshots) {
    if (s.equity < minEquity) minEquity = s.equity;
    if (s.equity > maxEquity) maxEquity = s.equity;
  }
  if (minEquity === maxEquity) {
    const eps = Math.max(Math.abs(minEquity) * 1e-6, 1e-6);
    minEquity -= eps;
    maxEquity += eps;
  }

  const tsSpan = lastTs - firstTs || 1;
  const eqSpan = maxEquity - minEquity || 1;
  const innerW = VIEW_W - PAD_X * 2;
  const innerH = VIEW_H - PAD_Y * 2;

  const points = snapshots
    .map((s) => {
      const x = PAD_X + ((s.ts - firstTs) / tsSpan) * innerW;
      const y = PAD_Y + (1 - (s.equity - minEquity) / eqSpan) * innerH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const baselineY = PAD_Y + (1 - (initialEquity - minEquity) / eqSpan) * innerH;

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className="w-full h-40">
      <line
        x1={PAD_X}
        x2={VIEW_W - PAD_X}
        y1={baselineY}
        y2={baselineY}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
      />
      <polyline points={points} fill="none" stroke="#f5a623" strokeWidth="1.5" />
      <text
        x={VIEW_W - PAD_X}
        y={PAD_Y + 8}
        textAnchor="end"
        fontFamily="monospace"
        fontSize="9"
        fill="rgba(255,255,255,0.4)"
      >
        {formatUsd(maxEquity)}
      </text>
      <text
        x={VIEW_W - PAD_X}
        y={VIEW_H - PAD_Y}
        textAnchor="end"
        fontFamily="monospace"
        fontSize="9"
        fill="rgba(255,255,255,0.4)"
      >
        {formatUsd(minEquity)}
      </text>
    </svg>
  );
}
