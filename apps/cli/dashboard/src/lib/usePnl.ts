import { useMemo } from 'react';
import type { DetailedPosition } from './types';

export interface PnlSnapshot {
  totalPnlUsd: number;
  totalCostUsd: number;
  roePercent: number;
  positionsValued: Array<DetailedPosition & { livePnlUsd: number; liveRoePercent: number }>;
}

export function computePnl(positions: DetailedPosition[], mids: Map<string, number>): PnlSnapshot {
  let totalPnl = 0;
  let totalCost = 0;
  const positionsValued: PnlSnapshot['positionsValued'] = [];

  for (const p of positions) {
    const live = mids.get(p.coin) ?? p.markPrice ?? p.entryPrice;
    const signedSize = p.side === 'long' ? p.size : -p.size;
    const livePnl = signedSize * (live - p.entryPrice);
    const cost = Math.abs(p.size) * p.entryPrice;
    const liveRoe = cost > 0 ? (livePnl / cost) * 100 : 0;
    totalPnl += livePnl;
    totalCost += cost;
    positionsValued.push({
      ...p,
      markPrice: live,
      livePnlUsd: livePnl,
      liveRoePercent: liveRoe,
    });
  }

  const roe = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  return { totalPnlUsd: totalPnl, totalCostUsd: totalCost, roePercent: roe, positionsValued };
}

export function usePnl(
  positions: DetailedPosition[],
  mids: Map<string, number>,
  midsTick: number,
): PnlSnapshot {
  return useMemo(
    () => computePnl(positions, mids),
    // mids is a fresh Map on every tick; depending on midsTick is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positions, midsTick],
  );
}
