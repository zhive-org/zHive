import { PineTS } from 'pinets';
import { HyperliquidProvider } from '../shared/tools/pinescript/providers/hyperliquid/provider';

(async () => {
  // pinets going to stripe provider out
  const asset = 'xyz:NVDA';
  const provider = await HyperliquidProvider.create({ dex: 'xyz' });

  const params = {
    script: `//@version=5
indicator('NVDA Strategy Signals (4h trend + 1h trigger + 4h vol/RSI)', overlay=false)

// --- 4h inputs (trend filter + momentum/volume) via request.security ---
ema20_4h   = request.security(syminfo.tickerid, '240', ta.ema(close, 20), lookahead=barmerge.lookahead_off)
ema50_4h   = request.security(syminfo.tickerid, '240', ta.ema(close, 50), lookahead=barmerge.lookahead_off)
ema200_4h  = request.security(syminfo.tickerid, '240', ta.ema(close, 200), lookahead=barmerge.lookahead_off)
atr_4h     = request.security(syminfo.tickerid, '240', ta.atr(14), lookahead=barmerge.lookahead_off)
rsi_4h     = request.security(syminfo.tickerid, '240', ta.rsi(close, 14), lookahead=barmerge.lookahead_off)

// 4h volume sum over last 4h bars (i.e., last 4 bars on 4h timeframe)
vol_sum_4h = request.security(syminfo.tickerid, '240', ta.sma(volume, 4) * 4, lookahead=barmerge.lookahead_off)
// 7-day avg of 4h volume => 7d * 24h / 4h = 42 bars on 4h timeframe
vol_avg_4h_7d = request.security(syminfo.tickerid, '240', ta.sma(volume, 42), lookahead=barmerge.lookahead_off)
volOk = vol_sum_4h >= 1.1 * vol_avg_4h_7d

// --- 1h trigger candle (most recent completed 1h candle) ---
// We run the candle logic inside 1h via request.security, so it aligns to last completed 1h bar.
// Bullish condition
c1h_close = request.security(syminfo.tickerid, '60', close, lookahead=barmerge.lookahead_off)
c1h_open  = request.security(syminfo.tickerid, '60', open,  lookahead=barmerge.lookahead_off)
c1h_low   = request.security(syminfo.tickerid, '60', low,   lookahead=barmerge.lookahead_off)
c1h_high  = request.security(syminfo.tickerid, '60', high,  lookahead=barmerge.lookahead_off)

atr_1h_for_offset = request.security(syminfo.tickerid, '60', ta.atr(14), lookahead=barmerge.lookahead_off)

bull1h = (c1h_close > c1h_open) and (c1h_close >= c1h_low + 0.25 * atr_1h_for_offset)
bear1h = (c1h_close < c1h_open) and (c1h_close <= c1h_high - 0.25 * atr_1h_for_offset)

// --- Pullback logic on 1h close relative to 4h EMA20 ---
// Long: 1h close between 0.2*ATR(4h) and 1.0*ATR(4h) below EMA20(4h)
// Short: between 0.2*ATR(4h) and 1.0*ATR(4h) above EMA20(4h)

distDown = ema20_4h - c1h_close
pullbackLong = distDown >= 0.2 * atr_4h and distDown <= 1.0 * atr_4h

distUp = c1h_close - ema20_4h
pullbackShort = distUp >= 0.2 * atr_4h and distUp <= 1.0 * atr_4h

// --- 4h EMA alignment ---
emaLongStack  = ema20_4h > ema50_4h and ema50_4h > ema200_4h
emaShortStack = ema20_4h < ema50_4h and ema50_4h < ema200_4h

momentumLong  = rsi_4h >= 40 and rsi_4h <= 65
momentumShort = rsi_4h >= 35 and rsi_4h <= 60

longCond  = emaLongStack and pullbackLong and bull1h and momentumLong and volOk
shortCond = emaShortStack and pullbackShort and bear1h and momentumShort and volOk

ready = not na(ema20_4h) and not na(ema50_4h) and not na(ema200_4h) and not na(atr_4h) and not na(rsi_4h) and not na(vol_avg_4h_7d) and not na(c1h_close) and not na(atr_1h_for_offset)

plot(ema20_4h, 'ema20_4h')
plot(ema50_4h, 'ema50_4h')
plot(ema200_4h, 'ema200_4h')
plot(atr_4h, 'atr_4h')
plot(rsi_4h, 'rsi_4h')
plot(volOk ? 1 : 0, 'volOk')
plot(longCond and ready ? 1 : 0, 'longCond')
plot(shortCond and ready ? 1 : 0, 'shortCond')
plot(ready ? 1 : 0, 'ready')

// debug label
if barstate.islast
    label.new(bar_index, high, 'emaStackLong=' + str.tostring(emaLongStack) + '\nemaStackShort=' + str.tostring(emaShortStack) + '\npullLong=' + str.tostring(pullbackLong) + '\npullShort=' + str.tostring(pullbackShort) + '\nbull1h=' + str.tostring(bull1h) + '\nbear1h=' + str.tostring(bear1h) + '\nrsi4h=' + str.tostring(rsi_4h) + '\nvolOk=' + str.tostring(volOk) + '\nlongCond=' + str.tostring(longCond) + '\nshortCond=' + str.tostring(shortCond) , style=label.style_label_left, textcolor=color.white, color=color.new(color.black, 0))`,
    timeframe: '60',
    fetchCandleCount: 350,
    returnBars: 1,
  };

  const pineTS = new PineTS(provider, asset, params.timeframe, params.fetchCandleCount);
  const result = (await pineTS.run(params.script)) as any;
  // return formatPineResult(result, returnBars);

  console.log(result);
})();
