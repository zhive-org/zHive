import { describe, expect, it, vi } from 'vitest';
import { CandleStore } from './candle-store';
import { BacktestClock } from './clock';
import { BacktestProvider } from './provider';
import { RawCandle } from './types';
import { HyperLiquidTimeframe } from '../tools/pinescript/providers/hyperliquid/timeframe';

const MIN = 60_000;
const HOUR = 60 * MIN;
const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);

function buildHourly(count: number, basePrice: number, start = t0): RawCandle[] {
  const out: RawCandle[] = [];
  for (let i = 0; i < count; i++) {
    const t = start + i * HOUR;
    const p = basePrice + i; // monotonically increasing — easy to spot a leak
    out.push({ t, T: t + HOUR - 1, o: p, h: p, l: p, c: p, v: 1, n: 1 });
  }
  return out;
}

describe('BacktestProvider', () => {
  it('clamps eDate to clock.now() — no lookahead even if caller asks for future data', async () => {
    const candles = buildHourly(48, 50_000);
    const store = CandleStore.fromSeed([
      { coin: 'BTC', interval: HyperLiquidTimeframe['1h'], candles },
    ]);
    const clock = new BacktestClock(t0 + 24 * HOUR);
    // Stub the inner provider so we don't hit network for getSymbolInfo.
    const inner = { getSymbolInfo: vi.fn(), configure: vi.fn() } as never;
    const p = new BacktestProvider(inner, store, clock);

    // Caller (PineScript via request.security) asks for 48 hours of data
    // ending in the future — provider must clamp.
    const data = await p.getMarketData('BTC', '60', 48, t0, t0 + 48 * HOUR);
    expect(data.length).toBeGreaterThan(0);
    for (const k of data) {
      expect(k.openTime).toBeLessThan(clock.now());
    }
  });

  it('returns no candles when window is entirely in the future', async () => {
    const candles = buildHourly(48, 50_000);
    const store = CandleStore.fromSeed([
      { coin: 'BTC', interval: HyperLiquidTimeframe['1h'], candles },
    ]);
    const clock = new BacktestClock(t0);
    const inner = { getSymbolInfo: vi.fn(), configure: vi.fn() } as never;
    const p = new BacktestProvider(inner, store, clock);

    const data = await p.getMarketData('BTC', '60', 10, t0 + HOUR, t0 + 5 * HOUR);
    expect(data).toHaveLength(0);
  });

  it('applies dex prefix to symbol lookup', async () => {
    const candles = buildHourly(10, 100);
    const store = CandleStore.fromSeed([
      { coin: 'xyz:SP500', interval: HyperLiquidTimeframe['1h'], candles },
    ]);
    const clock = new BacktestClock(t0 + 5 * HOUR);
    const inner = { getSymbolInfo: vi.fn(), configure: vi.fn() } as never;
    const p = new BacktestProvider(inner, store, clock, 'xyz');

    const data = await p.getMarketData('SP500', '60', 5);
    expect(data.length).toBeGreaterThan(0);
  });
});
