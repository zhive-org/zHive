import { tool } from 'ai';
import { join } from 'path';
import z from 'zod';
import { initializeAgentRuntime } from '../shared/agent';
import { getHiveDir } from '../shared/config/constant';
import { loadAgentEnv } from '../shared/config/env-loader';
import { PineScriptTimeframe } from '../shared/tools/pinescript/types';
import { AssetAnalyzer } from '../shared/trading/analyzer';
import { ZhiveExchange } from '../shared/trading/exchange/zhive';
import { PineTS } from 'pinets';
import { HyperliquidProvider } from '../shared/tools/pinescript/providers/hyperliquid/provider';
import { formatToolError } from '../shared/megathread/utils';
import { PineResult, formatPineResult } from '../shared/ta/utils';

(async () => {
  const exchange = await ZhiveExchange.create({
    // baseUrl: 'http://localhost:6969',
    apiKey: process.env.ZHIVE_API_KEY!,
  });
  const asset = 'xyz:NVDA';
  const provider = await HyperliquidProvider.create({ dex: 'xyz' });

  const pineTool = tool({
    description:
      'Execute a TradingView Pine Script v5/v6 against OHLC market data for an asset and return indicator values',
    inputSchema: z.object({
      script: z.string('Inline Pine Script v5 source code'),
      timeframe: z.enum(PineScriptTimeframe).describe('Candle interval'),
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
    execute: async ({ fetchCandleCount, returnBars, script, timeframe }) => {
      const pineTS = new PineTS(provider, asset, timeframe, fetchCandleCount);
      try {
        const result = (await pineTS.run(script)) as PineResult;
        return formatPineResult(result, returnBars);
      } catch (e) {
        return formatToolError(e, 'Executing pine script');
      }
    },
  });

  const dir = join(getHiveDir(), 'agents', 'swing');
  process.chdir(dir);
  await loadAgentEnv();
  const runtime = await initializeAgentRuntime();
  const analyzer = new AssetAnalyzer(runtime, exchange);

  const pairInfo = await exchange.getPairInfo(asset);
  const res = await analyzer.analyze({}, asset, pairInfo!, pineTool);

  console.log(res);
})();
