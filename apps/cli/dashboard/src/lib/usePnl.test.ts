import { describe, it, expect } from 'vitest';
import { computePnl } from './usePnl';
import type { DetailedPosition } from './types';

function basePosition(overrides: Partial<DetailedPosition> = {}): DetailedPosition {
  return {
    coin: 'BTC',
    side: 'long',
    size: 1,
    entryPrice: 100,
    markPrice: 100,
    positionValueUsd: 100,
    unrealizedPnl: 0,
    roePercent: 0,
    liquidationPx: null,
    marginUsed: 50,
    funding: 0,
    leverage: 2,
    ...overrides,
  };
}

describe('computePnl', () => {
  it('returns zeros for an empty position list', () => {
    const out = computePnl([], new Map());
    expect(out.totalPnlUsd).toBe(0);
    expect(out.totalMarginUsd).toBe(0);
    expect(out.roePercent).toBe(0);
    expect(out.positionsValued).toEqual([]);
  });

  it('computes ROE relative to margin, not notional, on a leveraged long', () => {
    const positions = [basePosition({ size: 1, entryPrice: 100, marginUsed: 10, leverage: 10 })];
    const mids = new Map([['BTC', 101]]);
    const out = computePnl(positions, mids);
    // pnl = +1 * (101-100) = +1; ROE = +1 / 10 (margin) = +10%, NOT 1% (notional)
    expect(out.totalPnlUsd).toBeCloseTo(1);
    expect(out.totalMarginUsd).toBeCloseTo(10);
    expect(out.roePercent).toBeCloseTo(10);
    expect(out.positionsValued[0].liveRoePercent).toBeCloseTo(10);
  });

  it('inverts pnl sign for a short', () => {
    const positions = [
      basePosition({ side: 'short', size: 1, entryPrice: 100, marginUsed: 50, leverage: 2 }),
    ];
    const mids = new Map([['BTC', 90]]);
    const out = computePnl(positions, mids);
    // pnl = -1 * (90-100) = +10; ROE = +10 / 50 = +20%
    expect(out.totalPnlUsd).toBeCloseTo(10);
    expect(out.roePercent).toBeCloseTo(20);
  });

  it('falls back to markPrice when the mid is missing', () => {
    const positions = [basePosition({ markPrice: 105, entryPrice: 100, size: 1 })];
    const mids = new Map<string, number>();
    const out = computePnl(positions, mids);
    expect(out.totalPnlUsd).toBeCloseTo(5);
    expect(out.positionsValued[0].markPrice).toBe(105);
  });

  it('falls back to entryPrice when neither mid nor markPrice exists', () => {
    const positions = [basePosition({ markPrice: null, entryPrice: 100, size: 1 })];
    const mids = new Map<string, number>();
    const out = computePnl(positions, mids);
    expect(out.totalPnlUsd).toBe(0);
    expect(out.roePercent).toBe(0);
  });

  it('aggregates multiple positions with mixed sides', () => {
    const positions = [
      basePosition({ coin: 'BTC', side: 'long', size: 1, entryPrice: 100, marginUsed: 50 }),
      basePosition({ coin: 'ETH', side: 'short', size: 2, entryPrice: 50, marginUsed: 50 }),
    ];
    const mids = new Map([
      ['BTC', 110], // +1 * (110-100) = +10
      ['ETH', 45], // -2 * (45-50)  = +10
    ]);
    const out = computePnl(positions, mids);
    expect(out.totalPnlUsd).toBeCloseTo(20);
    // total margin: 50 + 50 = 100; ROE = 20 / 100 = 20%
    expect(out.totalMarginUsd).toBeCloseTo(100);
    expect(out.roePercent).toBeCloseTo(20);
  });

  it('falls back to server roePercent when marginUsed is zero', () => {
    const positions = [basePosition({ marginUsed: 0, roePercent: 7.5 })];
    const mids = new Map([['BTC', 100]]);
    const out = computePnl(positions, mids);
    expect(out.positionsValued[0].liveRoePercent).toBeCloseTo(7.5);
  });

  it('guards aggregated ROE against zero total margin', () => {
    const positions = [basePosition({ marginUsed: 0, roePercent: 5 })];
    const mids = new Map([['BTC', 100]]);
    const out = computePnl(positions, mids);
    expect(out.roePercent).toBe(0);
  });
});
