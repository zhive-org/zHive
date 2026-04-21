import type { HiveClient } from '@zhive/sdk';
import type { IProvider, ISymbolInfo, Kline } from 'pinets';
import { PINETS_TO_ZHIVE_TF, ZHIVE_TIMEFRAME_TO_MS } from './timeframe';
import { PineTsTimeframe } from '../../types';

/**
 * The Hive API is only able to provide OHLC data; the rest is mocked.
 */
export class HiveDataProvider implements IProvider {
  constructor(private _client: HiveClient) {}

  async getMarketData(
    tickerId: string,
    timeframe: string,
    limit?: number,
    sDate?: number,
    eDate?: number,
  ): Promise<Kline[]> {
    const interval = PINETS_TO_ZHIVE_TF[timeframe as PineTsTimeframe];
    if (!interval) {
      throw new Error(`Unsupported timeframe "${timeframe}". Supported: 1h, 24h, 1d`);
    }

    const intervalMs = ZHIVE_TIMEFRAME_TO_MS[timeframe];
    const to = eDate ? new Date(eDate) : new Date();

    let from: Date;
    if (sDate) {
      from = new Date(sDate);
    } else {
      const effectiveLimit = limit ?? 100;
      from = new Date(to.getTime() - effectiveLimit * intervalMs);
    }

    const ohlcData = await this._client.market.getOHLC(tickerId, from, to, interval as any);

    let klines: Kline[] = ohlcData.map(
      ([timestamp, open, high, low, close]: [number, number, number, number, number]) => ({
        openTime: timestamp - intervalMs,
        open,
        high,
        low,
        close,
        volume: 0,
        closeTime: timestamp,
        quoteAssetVolume: 0,
        numberOfTrades: 0,
        takerBuyBaseAssetVolume: 0,
        takerBuyQuoteAssetVolume: 0,
        ignore: 0,
      }),
    );

    if (limit && klines.length > limit) {
      klines = klines.slice(-limit);
    }

    return klines;
  }

  async getSymbolInfo(tickerId: string): Promise<ISymbolInfo> {
    return {
      tickerid: tickerId,
      ticker: tickerId,
      current_contract: '',
      description: '',
      isin: '',
      main_tickerid: '',
      prefix: '',
      root: '',
      type: '',
      basecurrency: '',
      country: '',
      currency: '',
      timezone: '',
      employees: 0,
      industry: '',
      sector: '',
      shareholders: 0,
      shares_outstanding_float: 0,
      shares_outstanding_total: 0,
      expiration_date: 0,
      session: '',
      volumetype: '',
      mincontract: 0,
      minmove: 0,
      mintick: 0,
      pointvalue: 0,
      pricescale: 0,
      recommendations_buy: 0,
      recommendations_buy_strong: 0,
      recommendations_date: 0,
      recommendations_hold: 0,
      recommendations_sell: 0,
      recommendations_sell_strong: 0,
      recommendations_total: 0,
      target_price_average: 0,
      target_price_date: 0,
      target_price_estimates: 0,
      target_price_high: 0,
      target_price_low: 0,
      target_price_median: 0,
    };
  }

  configure(_config: any): void {
    // no-op
  }
}
