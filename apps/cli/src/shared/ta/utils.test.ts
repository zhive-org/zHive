import { describe, it, expect } from 'vitest';
import { formatPineResult, adjustFromDate, type PineResult } from './utils';

describe('formatPineResult', () => {
  const makeResult = (
    plotValues: Record<string, Array<number | boolean | null>>,
    marketDataLength: number,
  ): PineResult => ({
    plots: Object.fromEntries(
      Object.entries(plotValues).map(([name, values]) => [
        name,
        { data: values.map((v) => ({ value: v })) },
      ]),
    ),
    marketData: Array.from({ length: marketDataLength }, (_, i) => ({
      openTime: 1000 + i,
      open: 100 + i,
      close: 101 + i,
      closeTime: 1001 + i,
      high: 102 + i,
      low: 99 + i,
    })),
  });

  it('returns sliced plot data for the most recent N candles', () => {
    const result = makeResult({ rsi: [10, 20, 30, 40, 50] }, 5);
    const plotData = formatPineResult(result, 3);
    expect(plotData).toEqual({ rsi: [30, 40, 50] });
  });

  it('handles multiple plots correctly', () => {
    const result = makeResult(
      {
        rsi: [10, 20, 30, 40, 50],
        macd: [1, 2, 3, 4, 5],
      },
      5,
    );
    const plotData = formatPineResult(result, 2);
    expect(plotData).toEqual({ rsi: [40, 50], macd: [4, 5] });
  });

  it('returns all data when returnedCandleCount exceeds available data', () => {
    const result = makeResult({ rsi: [10, 20, 30] }, 3);
    const plotData = formatPineResult(result, 100);
    expect(plotData).toEqual({ rsi: [10, 20, 30] });
  });

  it('handles empty plots', () => {
    const result: PineResult = {
      plots: {},
      marketData: [{ openTime: 1, open: 1, close: 1, closeTime: 1, high: 1, low: 1 }],
    };
    const plotData = formatPineResult(result, 5);
    expect(plotData).toEqual({});
  });

  it('handles empty marketData', () => {
    const result: PineResult = {
      plots: { rsi: { data: [] } },
      marketData: [],
    };
    const plotData = formatPineResult(result, 5);
    expect(plotData).toEqual({ rsi: [] });
  });

  it('preserves null and boolean values in plot data', () => {
    const result = makeResult({ signal: [null, true, false, 42, null] }, 5);
    const plotData = formatPineResult(result, 3);
    expect(plotData).toEqual({ signal: [false, 42, null] });
  });
});

describe('adjustFromDate', () => {
  it('adjusts date backwards for hourly interval with 30% buffer', () => {
    const from = new Date('2026-03-25T12:00:00.000Z');
    const result = adjustFromDate(from, 100, 'hourly');
    // 100 + ceil(100*0.3) = 130 hours back
    const expected = new Date(from.getTime() - 130 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  it('adjusts date backwards for daily interval with 30% buffer', () => {
    const from = new Date('2026-03-25T12:00:00.000Z');
    const result = adjustFromDate(from, 100, 'daily');
    // 100 + ceil(100*0.3) = 130 days back
    const expected = new Date(from.getTime() - 130 * 24 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  it('accepts string input', () => {
    const fromStr = '2026-03-25T12:00:00.000Z';
    const result = adjustFromDate(fromStr, 10, 'hourly');
    // 10 + ceil(10*0.3) = 13 hours back
    const expected = new Date(new Date(fromStr).getTime() - 13 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  it('produces correct ISO string output', () => {
    const result = adjustFromDate('2026-01-01T00:00:00.000Z', 50, 'daily');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('applies ceil to buffer calculation', () => {
    // minPoints=1 => buffer = ceil(1*0.3) = 1, total=2
    const from = new Date('2026-03-25T12:00:00.000Z');
    const result = adjustFromDate(from, 1, 'hourly');
    const expected = new Date(from.getTime() - 2 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });
});
