import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { SymbolConverter } from '@nktkas/hyperliquid/utils';
import { IProvider, ISymbolInfo, Kline } from 'pinets';
import _ from 'lodash';
import { PINETS_TO_HYPERLIQUID_TF } from './timeframe';
import { PineTsTimeframe } from '../../types';
import { timeframeToMs } from './utils';
import { HyperliquidService } from '../../../../hyperliquid/service';

export class HyperliquidProvider implements IProvider {
  private constructor(
    private hl: HyperliquidService,
    private converter: SymbolConverter,
    private dex?: string,
  ) {}

  private getSymbol(tickerId: string) {
    // pinets will stripe exchange prefix (e.g. "BINANCE:BTCUSDC" → "BTCUSDC")  when creating secondary context with request.security
    const dexPrefix = this.dex ? `${this.dex}:` : '';
    return tickerId.includes(':') ? tickerId : `${dexPrefix}${tickerId}`;
  }

  static async create({ dex }: { dex?: string } = {}) {
    const transport = new HttpTransport();
    const info = new InfoClient({ transport });
    const hl = new HyperliquidService(info);
    const converter = await SymbolConverter.create({ transport, dexs: true });

    return new HyperliquidProvider(hl, converter, dex);
  }

  async getMarketData(
    tickerId: string,
    timeframe: string,
    limit: number = 200,
    sDate?: number,
    eDate?: number,
  ): Promise<Kline[]> {
    const hyperliquidTF = PINETS_TO_HYPERLIQUID_TF[timeframe as PineTsTimeframe];
    if (!hyperliquidTF) {
      throw new Error(`Invalid timeframe ${timeframe}`);
    }
    if (!sDate || !eDate) {
      eDate = eDate ?? Date.now();
      sDate = sDate ?? eDate - limit * timeframeToMs(hyperliquidTF);
    }

    const symbol = this.getSymbol(tickerId);

    const raw = await this.hl.candleSnapshot({
      coin: symbol,
      interval: hyperliquidTF,
      startTime: sDate,
      endTime: eDate,
    });

    const candles: Kline[] = raw.map((c) => {
      const open = parseFloat(c.o);
      const high = parseFloat(c.h);
      const low = parseFloat(c.l);
      const close = parseFloat(c.c);
      const volume = parseFloat(c.v);

      return {
        openTime: c.t,
        closeTime: c.T,
        open,
        high,
        low,
        close,
        volume,
        numberOfTrades: c.n,
        // Hyperliquid doesn't return quote volume — approximate with volume * typical price
        quoteAssetVolume: volume * ((high + low + close) / 3),
        // No taker breakdown on Hyperliquid candles — zero is safest
        takerBuyBaseAssetVolume: 0,
        takerBuyQuoteAssetVolume: 0,
        ignore: 0,
      };
    });

    return candles;
  }
  async getSymbolInfo(tickerId: string): Promise<ISymbolInfo> {
    const [meta, assetCtxs] = await this.hl.metaAndAssetCtxs({ dex: this.dex });

    const symbol = this.getSymbol(tickerId);
    const assetIndex = meta.universe.findIndex((u) => u.name === symbol);
    if (assetIndex === -1) {
      throw new Error('ticker not found');
    }
    const asset = assetCtxs[assetIndex];

    const szDecimals = this.converter.getSzDecimals(symbol);
    if (_.isNil(szDecimals)) {
      throw new Error('ticker not found');
    }

    // Hyperliquid price precision: min(5 sig figs, 6 - szDecimals decimals) for perps
    const maxDecimals = 6 - szDecimals;
    const sigFigDecimals = Math.max(0, 4 - Math.floor(Math.log10(parseFloat(asset.markPx))));
    const pxDecimals = Math.min(maxDecimals, sigFigDecimals);
    const mintick = Math.pow(10, -pxDecimals);
    const pricescale = Math.pow(10, pxDecimals);

    const syminfo = {
      // Identity
      current_contract: `${symbol}-PERP`,
      description: `${symbol} Perpetual`,
      isin: '',
      prefix: 'HYPERLIQUID',
      root: symbol,
      ticker: symbol,
      main_tickerid: symbol,
      tickerid: symbol,
      type: 'crypto',

      // Market metadata
      basecurrency: symbol,
      country: '',
      currency: 'USD', // Hyperliquid perps settle in USDC but quote in USD terms
      timezone: 'Etc/UTC',
      session: '24x7', // Pine uses this string for 24/7 markets

      // Equity fields — zero them out
      employees: 0,
      industry: '',
      sector: '',
      shareholders: 0,
      shares_outstanding_float: 0,
      shares_outstanding_total: 0,

      // Futures fields
      expiration_date: 0, // perps never expire
      mincontract: Math.pow(10, -szDecimals), // minimum order size

      // Price mechanics — THE important ones
      volumetype: 'base',
      minmove: 1,
      mintick,
      pricescale,
      pointvalue: 1, // 1 USD per 1.0 price move per 1 unit of base

      // Analyst recommendations — all zero
      recommendations_buy: 0,
      recommendations_buy_strong: 0,
      recommendations_date: 0,
      recommendations_hold: 0,
      recommendations_sell: 0,
      recommendations_sell_strong: 0,
      recommendations_total: 0,

      // Price targets — all zero
      target_price_average: 0,
      target_price_date: 0,
      target_price_estimates: 0,
      target_price_high: 0,
      target_price_low: 0,
      target_price_median: 0,
    };
    return syminfo;
  }
  configure(config: any): void {}
}
