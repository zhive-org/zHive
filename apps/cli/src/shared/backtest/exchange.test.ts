import { beforeEach, describe, expect, it } from 'vitest';
import { PositionFlipNotSupported, PositionNotFound, UnknownError } from '../trading/exchange/error';
import { TradeDecision } from '../trading/types';
import { CandleStore } from './candle-store';
import { BacktestClock } from './clock';
import { BacktestExchange } from './exchange';
import { RawCandle } from './types';
import { HyperLiquidTimeframe } from '../tools/pinescript/providers/hyperliquid/timeframe';

const MIN = 60_000;
const HOUR = 60 * MIN;

const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);

function flatCandles(price: number, count: number, intervalMs: number, start = t0): RawCandle[] {
  const out: RawCandle[] = [];
  for (let i = 0; i < count; i++) {
    const t = start + i * intervalMs;
    out.push({ t, T: t + intervalMs - 1, o: price, h: price, l: price, c: price, v: 1, n: 1 });
  }
  return out;
}

function decision(overrides: Partial<TradeDecision> = {}): TradeDecision {
  return {
    asset: 'BTC',
    action: 'LONG',
    sizeUsd: 1000,
    leverage: 5,
    reasoning: 'test',
    tp: null,
    sl: null,
    ...overrides,
  };
}

function buildStore(candles: { '1m': RawCandle[]; '1h': RawCandle[] }): CandleStore {
  return CandleStore.fromSeed([
    { coin: 'BTC', interval: HyperLiquidTimeframe['1m'], candles: candles['1m'] },
    { coin: 'BTC', interval: HyperLiquidTimeframe['1h'], candles: candles['1h'] },
  ]);
}

describe('BacktestExchange', () => {
  let clock: BacktestClock;

  beforeEach(() => {
    clock = new BacktestClock(t0);
  });

  it('opens a LONG and deducts margin + fee from cash', async () => {
    const store = buildStore({
      '1m': flatCandles(50_000, 24 * 60, MIN),
      '1h': flatCandles(50_000, 24, HOUR),
    });
    const ex = new BacktestExchange(clock, store, {
      initialCashUsd: 10_000,
      slippage: 0.03,
      feeBps: 2.5,
    });

    const result = await ex.placeOrder(decision({ action: 'LONG', sizeUsd: 1000, leverage: 5 }));

    // entry = 50000 * 1.03 = 51_500; size = 1000 / 51500
    expect(Number(result.size)).toBeCloseTo(1000 / 51_500, 8);
    const account = await ex.fetchAccountState();
    // margin 200 + fee 1000 * 0.00025 = 0.25
    expect(account.withdrawable).toBeCloseTo(10_000 - 200 - 0.25, 4);
    expect(account.positions).toHaveLength(1);
    expect(account.positions[0].side).toBe('long');
  });

  it('rejects opposite-side opens with PositionFlipNotSupported', async () => {
    const store = buildStore({
      '1m': flatCandles(50_000, 24 * 60, MIN),
      '1h': flatCandles(50_000, 24, HOUR),
    });
    const ex = new BacktestExchange(clock, store, { initialCashUsd: 10_000 });
    await ex.placeOrder(decision({ action: 'LONG' }));
    await expect(ex.placeOrder(decision({ action: 'SHORT' }))).rejects.toBeInstanceOf(
      PositionFlipNotSupported,
    );
  });

  it('throws on CLOSE without an open position', async () => {
    const store = buildStore({
      '1m': flatCandles(50_000, 60, MIN),
      '1h': flatCandles(50_000, 1, HOUR),
    });
    const ex = new BacktestExchange(clock, store, { initialCashUsd: 10_000 });
    await expect(ex.placeOrder(decision({ action: 'CLOSE' }))).rejects.toBeInstanceOf(
      PositionNotFound,
    );
  });

  it('rejects when cash is insufficient', async () => {
    const store = buildStore({
      '1m': flatCandles(50_000, 60, MIN),
      '1h': flatCandles(50_000, 1, HOUR),
    });
    const ex = new BacktestExchange(clock, store, { initialCashUsd: 100 });
    await expect(
      ex.placeOrder(decision({ action: 'LONG', sizeUsd: 1000, leverage: 5 })),
    ).rejects.toBeInstanceOf(UnknownError);
  });

  it('triggers SL on a long when 1m candle low pierces stop', async () => {
    const oneM = flatCandles(50_000, 120, MIN);
    // bar 60 dips to trigger SL at ~49_490 (entry 51_500, sl 10% PnL @ 5x = 2% move = 50_470, hm)
    // Use sl=20 (PnL%) at lev=5 → 4% price move: stop = 51_500 * 0.96 = 49_440
    oneM[60] = { ...oneM[60], l: 49_400, h: 50_000, o: 50_000, c: 49_500 };

    const store = buildStore({ '1m': oneM, '1h': flatCandles(50_000, 24, HOUR) });
    const ex = new BacktestExchange(clock, store, {
      initialCashUsd: 10_000,
      slippage: 0.03,
      feeBps: 0,
    });

    await ex.placeOrder(decision({ action: 'LONG', sizeUsd: 1000, leverage: 5, sl: 20, tp: 50 }));

    // Advance an hour (60 1m bars — bar index 60 is on the boundary; pick an hour past)
    const advanceTo = t0 + 90 * MIN;
    await ex.advanceTo(advanceTo);

    const fills = ex['fills_']();
    const sl = fills.find((f) => f.action === 'CLOSE_SL');
    expect(sl).toBeDefined();
    // Trigger price = 51_500 * 0.96 = 49_440
    expect(sl!.price).toBeCloseTo(49_440, 1);
    expect(sl!.realizedPnlUsd).toBeLessThan(0);
  });

  it('triggers TP on a long when 1m candle high pierces target', async () => {
    const oneM = flatCandles(50_000, 120, MIN);
    // tp=50 PnL @ lev=5 → 10% price move; entry 51_500 * 1.10 = 56_650
    oneM[40] = { ...oneM[40], h: 57_000, l: 50_000, o: 50_500, c: 56_700 };

    const store = buildStore({ '1m': oneM, '1h': flatCandles(50_000, 24, HOUR) });
    const ex = new BacktestExchange(clock, store, {
      initialCashUsd: 10_000,
      slippage: 0.03,
      feeBps: 0,
    });

    await ex.placeOrder(decision({ action: 'LONG', sizeUsd: 1000, leverage: 5, sl: 20, tp: 50 }));
    await ex.advanceTo(t0 + 90 * MIN);

    const fills = ex['fills_']();
    const tp = fills.find((f) => f.action === 'CLOSE_TP');
    expect(tp).toBeDefined();
    expect(tp!.price).toBeCloseTo(56_650, 1);
    expect(tp!.realizedPnlUsd).toBeGreaterThan(0);
  });

  it('SL wins on a straddle bar (pessimistic)', async () => {
    const oneM = flatCandles(50_000, 120, MIN);
    // Bar that hits both SL (low → 49_000) and TP (high → 57_000)
    oneM[30] = { ...oneM[30], h: 57_000, l: 49_000, o: 50_000, c: 50_100 };

    const store = buildStore({ '1m': oneM, '1h': flatCandles(50_000, 24, HOUR) });
    const ex = new BacktestExchange(clock, store, {
      initialCashUsd: 10_000,
      slippage: 0.03,
      feeBps: 0,
    });
    await ex.placeOrder(decision({ action: 'LONG', sizeUsd: 1000, leverage: 5, sl: 20, tp: 50 }));
    await ex.advanceTo(t0 + 60 * MIN);

    const fills = ex['fills_']();
    const close = fills.find((f) => f.action !== 'OPEN');
    expect(close?.action).toBe('CLOSE_SL');
  });

  it('manual CLOSE realizes PnL using mark ± slippage', async () => {
    const oneM = flatCandles(50_000, 120, MIN);
    // Move price up substantially so the round-trip slippage doesn't swamp the move
    for (let i = 60; i < 120; i++)
      oneM[i] = { ...oneM[i], o: 60_000, h: 60_000, l: 60_000, c: 60_000 };

    const store = buildStore({ '1m': oneM, '1h': flatCandles(50_000, 24, HOUR) });
    const ex = new BacktestExchange(clock, store, {
      initialCashUsd: 10_000,
      slippage: 0.03,
      feeBps: 0,
    });
    await ex.placeOrder(decision({ action: 'LONG', sizeUsd: 1000, leverage: 5 }));

    // Advance to t0 + 60m, set the clock so mark is now 60_000
    await ex.advanceTo(t0 + 60 * MIN);
    clock.set(t0 + 60 * MIN);
    await ex.placeOrder(decision({ action: 'CLOSE' }));

    const fills = ex['fills_']();
    const close = fills.find((f) => f.action === 'CLOSE_MANUAL');
    expect(close).toBeDefined();
    // Exit price = 60_000 * 0.97
    expect(close!.price).toBeCloseTo(60_000 * 0.97, 1);
    expect(close!.realizedPnlUsd).toBeGreaterThan(0);
  });
});
