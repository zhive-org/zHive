import { tool } from 'ai';
import { IProvider, PineTS } from 'pinets';
import z from 'zod';
import { formatToolError } from '../../megathread/utils';
import { PineResult, formatPineResult } from '../../ta/utils';
import { PineTsTimeframe, pinetsTimeframes } from './types';

const inputSchema = z.object({
  asset: z.string().describe('The asset symbol to analyze, e.g. BTC, ETH'),
  script: z.string().describe('Inline Pine Script v5 source code'),
  timeframe: z.enum(pinetsTimeframes).describe('Candle interval'),
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
});

export const createPineScriptTool = (
  provider: IProvider,
  supportedTimeframes: PineTsTimeframe[] = [...pinetsTimeframes],
) => {
  return tool({
    description:
      'Execute a TradingView Pine Script v5/v6 against OHLC market data for an asset and return indicator values',
    inputSchema: inputSchema.omit({ timeframe: true }).extend({
      timeframe: z.enum(supportedTimeframes).describe('Candle interval'),
    }),
    execute: async (input) => {
      return executePinescript(input, provider);
    },
  });
};

export const createPineScriptToolForAsset = (asset: string, provider: IProvider) => {
  return tool({
    description:
      'Execute a TradingView Pine Script v5/v6 against OHLC market data for an asset and return indicator values',
    inputSchema: inputSchema.omit({ asset: true }),
    execute: async (input) => {
      return executePinescript({ ...input, asset }, provider);
    },
  });
};

async function executePinescript(
  { asset, script, timeframe, fetchCandleCount, returnBars }: z.infer<typeof inputSchema>,
  provider: IProvider,
) {
  const pineTS = new PineTS(provider, asset, timeframe, fetchCandleCount);
  try {
    const result = (await pineTS.run(script)) as PineResult;
    return formatPineResult(result, returnBars);
  } catch (e) {
    return formatToolError(e, 'Executing pine script');
  }
}
