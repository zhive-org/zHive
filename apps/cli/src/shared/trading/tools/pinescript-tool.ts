import { tool } from 'ai';
import { PineTS } from 'pinets';
import z from 'zod';
import { formatToolError } from '../../agent/utils';
import { PineResult, formatPineResult } from '../../ta/utils';
import { Candle, Timeframe } from '../types';
import { timeframeToMs } from '../utils';

export const createPineScriptTool = (
  fetchCandles: (
    symbol: string,
    timeframe: Timeframe,
    startTime: number,
    endTime: number,
  ) => Promise<Candle[]>,
) => {
  return tool({
    description:
      'Execute a TradingView Pine Script v5/v6 against OHLC market data for an asset and return indicator values',
    inputSchema: z.object({
      asset: z.string().describe('The asset symbol to analyze, e.g. BTC, ETH'),
      script: z.string().describe('Inline Pine Script v5 source code'),
      timeframe: z.enum(Timeframe).describe('Candle interval'),
      fetchCandleCount: z
        .number()
        .int()
        .min(1)
        .max(1500)
        .default(100)
        .describe(
          'Number of historical candles to fetch. Indicators need lookback data, so set this higher than the indicator period (e.g. 200 for RSI 50). Default: 100',
        ),
      returnBars: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe('Number of most-recent bars to return (default: 20)'),
    }),
    execute: async ({ asset, script, timeframe, fetchCandleCount, returnBars }) => {
      const endTime = Date.now();
      const startTime = endTime - fetchCandleCount * timeframeToMs(timeframe);
      const candles = await fetchCandles(asset, timeframe, startTime, endTime);
      if (candles.length === 0) {
        return {
          error: 'No candle data available for the requested range',
        };
      }

      const klines = candles.map((c) => ({
        openTime: c.openTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        closeTime: c.openTime,
      }));

      const pineTS = new PineTS(klines);
      try {
        const result = (await pineTS.run(script)) as PineResult;
        return formatPineResult(result, returnBars);
      } catch (e) {
        return formatToolError(e, 'Executing pine script');
      }
    },
  });
};
