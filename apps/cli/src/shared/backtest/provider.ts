import { IProvider, ISymbolInfo, Kline } from 'pinets';
import { HyperliquidProvider } from '../tools/pinescript/providers/hyperliquid/provider';
import { PINETS_TO_HYPERLIQUID_TF } from '../tools/pinescript/providers/hyperliquid/timeframe';
import { timeframeToMs } from '../tools/pinescript/providers/hyperliquid/utils';
import { PineTsTimeframe } from '../tools/pinescript/types';
import { CandleStore } from './candle-store';
import { BacktestClock } from './clock';

/**
 * IProvider implementation that serves PineScript candle data from a local
 * CandleStore, clamped to the BacktestClock so the strategy can never see
 * data from beyond `now()`.
 *
 * Composes a HyperliquidProvider for the static metadata path
 * (`getSymbolInfo`, dex-prefixing). Only `getMarketData` diverges.
 */
export class BacktestProvider implements IProvider {
  constructor(
    private inner: HyperliquidProvider,
    private store: CandleStore,
    private clock: BacktestClock,
    private dex?: string,
  ) {}

  static async create(opts: {
    store: CandleStore;
    clock: BacktestClock;
    dex?: string;
  }): Promise<BacktestProvider> {
    const inner = await HyperliquidProvider.create({ dex: opts.dex });
    return new BacktestProvider(inner, opts.store, opts.clock, opts.dex);
  }

  private resolveSymbol(tickerId: string): string {
    const dexPrefix = this.dex ? `${this.dex}:` : '';
    return tickerId.includes(':') ? tickerId : `${dexPrefix}${tickerId}`;
  }

  async getMarketData(
    tickerId: string,
    timeframe: string,
    limit: number = 200,
    sDate?: number,
    eDate?: number,
  ): Promise<Kline[]> {
    const hlTF = PINETS_TO_HYPERLIQUID_TF[timeframe as PineTsTimeframe];
    if (!hlTF) {
      throw new Error(`Invalid timeframe ${timeframe}`);
    }

    const now = this.clock.now();
    const cappedEnd = Math.min(eDate ?? now, now);
    const start = sDate ?? cappedEnd - limit * timeframeToMs(hlTF);

    if (cappedEnd <= start) return [];

    const symbol = this.resolveSymbol(tickerId);
    const raw = await this.store.getCandles(symbol, hlTF, start, cappedEnd);

    return raw.map((c) => ({
      openTime: c.t,
      closeTime: c.T,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
      volume: c.v,
      numberOfTrades: c.n,
      quoteAssetVolume: c.v * ((c.h + c.l + c.c) / 3),
      takerBuyBaseAssetVolume: 0,
      takerBuyQuoteAssetVolume: 0,
      ignore: 0,
    }));
  }

  getSymbolInfo(tickerId: string): Promise<ISymbolInfo> {
    return this.inner.getSymbolInfo(tickerId);
  }

  configure(config: unknown): void {
    this.inner.configure(config);
  }
}
