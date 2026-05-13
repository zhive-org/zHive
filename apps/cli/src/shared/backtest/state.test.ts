import { describe, expect, it } from 'vitest';
import { getRunningBacktest, startBacktestSession, tryStartBacktestSession } from './state';

const baseInit = {
  from: 1_700_000_000_000,
  to: 1_700_000_000_000 + 10 * 60 * 60 * 1000,
  intervalMs: 60 * 60 * 1000,
  initialCashUsd: 10_000,
  watchList: ['HL:BTC'],
  source: 'cli' as const,
};

describe('backtest state singleton', () => {
  it('reports null when no backtest is running', () => {
    // Ensure clean state by finishing any leftover handle (idempotent).
    const before = getRunningBacktest();
    expect(before).toBeNull();
  });

  it('tracks ticks and clears on finish', () => {
    const handle = startBacktestSession(baseInit);
    expect(getRunningBacktest()?.ticksCompleted).toBe(0);

    handle.tick({ currentTime: baseInit.from + baseInit.intervalMs, currentEquity: 10_100 });
    const p1 = getRunningBacktest();
    expect(p1?.ticksCompleted).toBe(1);
    expect(p1?.currentEquity).toBe(10_100);
    expect(p1?.percent).toBeGreaterThan(0);
    expect(p1?.percent).toBeLessThan(100);

    handle.finish();
    expect(getRunningBacktest()).toBeNull();
  });

  it('throws when starting a second session while one is running', () => {
    const handle = startBacktestSession(baseInit);
    expect(() => startBacktestSession(baseInit)).toThrow(/already running/);
    handle.finish();
  });

  it('tryStart returns existing progress instead of starting', () => {
    const first = startBacktestSession(baseInit);
    first.tick({ currentTime: baseInit.from + 2 * baseInit.intervalMs, currentEquity: 9_900 });

    const second = tryStartBacktestSession(baseInit);
    expect('running' in second).toBe(true);
    if ('running' in second) {
      expect(second.running.ticksCompleted).toBe(1);
      expect(second.running.currentEquity).toBe(9_900);
    }
    first.finish();
  });

  it('clears state on fail', () => {
    const handle = startBacktestSession(baseInit);
    handle.fail(new Error('boom'));
    expect(getRunningBacktest()).toBeNull();
  });
});
