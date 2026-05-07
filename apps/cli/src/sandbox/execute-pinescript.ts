import { PineTS } from 'pinets';
import { HyperliquidProvider } from '../shared/tools/pinescript/providers/hyperliquid/provider';
import { formatPineResult } from '../shared/ta/utils';

(async () => {
  // pinets going to stripe provider out
  const asset = 'BTC';
  const provider = await HyperliquidProvider.create();

  const params = {
    script: `
//@version=6
indicator("Filtered EMA cross — exercise", overlay=true)

sma50 = ta.sma(close, 9)
sma200 = ta.sma(close, 21)

goldenCross = ta.crossover(sma50, sma200)

// Plot the moving averages so you can see the crossovers
plot(sma50,  "SMA 50",  color=color.blue)
plot(sma200, "SMA 200", color=color.orange)

plotshape(goldenCross,
          title="Golden Cross",
          style=shape.triangleup,
          location=location.belowbar,
          color=color.green,
          size=size.small,
          text="GC",
          textcolor=color.white)`,
    timeframe: 'D',
    fetchCandleCount: 500,
    returnBars: 100,
  };

  const pineTS = new PineTS(provider, asset, params.timeframe, params.fetchCandleCount);
  const result = (await pineTS.run(params.script)) as any;
  const formatted = formatPineResult(result, params.returnBars);

  console.log(formatted);
})();
