import { useMemo } from 'react';
import type { DetailedPosition } from './types';

export interface PnlSnapshot {
  totalPnlUsd: number;
  totalMarginUsd: number;
  roePercent: number;
  positionsValued: Array<DetailedPosition & { livePnlUsd: number; liveRoePercent: number }>;
}

export function computePnl(positions: DetailedPosition[], mids: Map<string, number>): PnlSnapshot {
  let totalPnl = 0;
  let totalMargin = 0;
  const positionsValued: PnlSnapshot['positionsValued'] = [];

  for (const p of positions) {
    const live = mids.get(p.coin) ?? p.markPrice ?? p.entryPrice;
    const signedSize = p.side === 'long' ? p.size : -p.size;
    const livePnl = signedSize * (live - p.entryPrice);
    // ROE is return-on-equity: PnL relative to the margin posted, NOT the
    // notional. A 10× position on a 1% mid move should show ≈10% ROE, which
    // matches the server-provided roePercent. Fall back to the snapshot's
    // roePercent if marginUsed isn't available.
    const liveRoe =
      p.marginUsed > 0
        ? (livePnl / p.marginUsed) * 100
        : Number.isFinite(p.roePercent)
          ? p.roePercent
          : 0;
    totalPnl += livePnl;
    totalMargin += Math.max(0, p.marginUsed);
    positionsValued.push({
      ...p,
      markPrice: live,
      livePnlUsd: livePnl,
      liveRoePercent: liveRoe,
    });
  }

  const roe = totalMargin > 0 ? (totalPnl / totalMargin) * 100 : 0;
  return {
    totalPnlUsd: totalPnl,
    totalMarginUsd: totalMargin,
    roePercent: roe,
    positionsValued,
  };
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
