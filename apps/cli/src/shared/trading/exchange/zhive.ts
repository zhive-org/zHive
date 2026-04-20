import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { formatPrice, formatSize, SymbolConverter } from '@nktkas/hyperliquid/utils';
import _ from 'lodash';
import { HIVE_API_URL } from '../../config/constant';
import { Candle, Timeframe } from '../../tools/pinescript';
import {
  AccountSummary,
  AssetContext,
  DetailedPosition,
  ExecutionResult,
  TradeDecision,
} from '../types';
import { IExchange } from './types';
import { PositionNotFound, UnSupportedAssetError } from './error';

export interface PositionSummary {
  token_id: string;
  net_size: number;
  avg_entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  position_value: number;
  stop_loss?: number;
  take_profit?: number;
}

type PortfolioSummaryResponse = {
  cash_balance: number;
  positions: PositionSummary[];
  total_unrealized_pnl: number;
  total_equity: number;
};

export class ZhiveExchange implements IExchange {
  constructor(
    private baseUrl: string,
    private info: InfoClient,
    private converter: SymbolConverter,
    private apiKey?: string,
  ) {}

  static async create({
    baseUrl = HIVE_API_URL,
    apiKey,
  }: {
    baseUrl?: string;
    apiKey?: string;
  } = {}): Promise<ZhiveExchange> {
    const transport = new HttpTransport();

    const info = new InfoClient({ transport });
    const converter = await SymbolConverter.create({ transport });

    return new ZhiveExchange(baseUrl, info, converter, apiKey);
  }

  async placeOrder(order: TradeDecision): Promise<ExecutionResult> {
    const assetId = this.converter.getAssetId(order.coin);
    if (_.isNil(assetId)) {
      throw new UnSupportedAssetError();
    }

    if (order.action === 'CLOSE') {
      return await this._executeMarketClose(order);
    }

    return await this._executeMarketOpen(order);
  }

  async getAvailableTradingPairs(): Promise<string[]> {
    const results = await Promise.all([
      this.info.metaAndAssetCtxs(),
      this.info.metaAndAssetCtxs({ dex: 'xyz' }),
    ]);

    const pairs: string[] = [];
    for (const [meta] of results) {
      for (const u of meta.universe) {
        pairs.push(u.name);
      }
    }

    return pairs;
  }

  private async _executeMarketClose(d: TradeDecision): Promise<ExecutionResult> {
    if (!this.apiKey) {
      throw new Error('api key is required');
    }

    const assetId = this.converter.getAssetId(d.coin);
    if (_.isNil(assetId)) {
      throw new UnSupportedAssetError();
    }

    const account = await this.fetchAccountState();
    const position = account.positions.find((p) => p.coin === d.coin);
    if (!position) {
      throw new PositionNotFound();
    }

    const isBuy = position.side === 'short';

    const req: {
      token_id: string;
      position_delta: number;
    } = {
      token_id: d.coin,
      position_delta: position.size * (isBuy ? 1 : -1),
    };

    const url = `${this.baseUrl}/v2/order/close`;
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(req),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Create order Failed: ${response.status} - ${text}`);
    }

    return {
      coin: d.coin,
      action: 'CLOSE',
      size: position.size.toString(),
    };
  }

  private async _executeMarketOpen(order: TradeDecision): Promise<ExecutionResult> {
    if (!this.apiKey) {
      throw new Error('api key is required');
    }

    const isBuy = order.action === 'LONG';
    // convert size from usd to currency unit
    const mids = await this.info.allMids();
    const szDecimal = this.converter.getSzDecimals(order.coin);
    if (!(order.coin in mids) || _.isNil(szDecimal)) {
      throw new UnSupportedAssetError();
    }

    const entryPrice = parseFloat(mids[order.coin]);
    const size = formatSize((order.sizeUsd / entryPrice) * (isBuy ? 1 : -1), szDecimal);

    const req: {
      token_id: string;
      position_delta: string;
      stop_loss?: string;
      take_profit?: string;
    } = {
      token_id: order.coin,
      position_delta: size,
    };

    let slPrice: string | undefined;
    let tpPrice: string | undefined;

    if (order.sl) {
      const priceMovePct = order.sl / order.leverage / 100;
      // SL triggers when price moves against the position
      const triggerPrice = entryPrice * (isBuy ? 1 - priceMovePct : 1 + priceMovePct);
      slPrice = formatPrice(triggerPrice, szDecimal);
      req.stop_loss = slPrice;
    }

    if (order.tp) {
      const priceMovePct = order.tp / order.leverage / 100;
      const triggerPrice = entryPrice * (isBuy ? 1 + priceMovePct : 1 - priceMovePct);
      tpPrice = formatPrice(triggerPrice, szDecimal);
      req.take_profit = tpPrice;
    }

    const url = `${this.baseUrl}/v2/order/open`;
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(req),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Create order Failed: ${response.status} - ${text}`);
    }

    return {
      coin: order.coin,
      action: order.action,
      size: Math.abs(Number(size)).toString(),
      slPrice,
      tpPrice,
    };
  }

  async getPairInfo(pair: string): Promise<AssetContext | null> {
    const parts = pair.split(':');
    let dex: string | undefined;
    if (parts.length === 2) {
      dex = parts[0];
    }

    const [meta, assetCtxs] = await this.info.metaAndAssetCtxs({ dex });

    const assetIndex = meta.universe.findIndex((u) => u.name === pair);
    if (assetIndex === -1) {
      return null;
    }

    const ctx = assetCtxs[assetIndex];
    return {
      coin: pair,
      ...ctx,
    };
  }

  async fetchCandles(
    pair: string,
    interval: Timeframe,
    sDate: number | Date,
    eDate: number | Date,
  ): Promise<Candle[]> {
    const raw = await this.info.candleSnapshot({
      coin: pair,
      interval,
      startTime: sDate instanceof Date ? sDate.getTime() : sDate,
      endTime: eDate instanceof Date ? eDate.getTime() : eDate,
    });

    const candles: Candle[] = raw.map((c) => ({
      openTime: c.t,
      open: parseFloat(c.o),
      high: parseFloat(c.h),
      low: parseFloat(c.l),
      close: parseFloat(c.c),
      volume: parseFloat(c.v),
    }));

    return candles;
  }

  async fetchAccountState(): Promise<AccountSummary> {
    if (!this.apiKey) {
      throw new Error('api key is required');
    }

    const response = await fetch(`${this.baseUrl}/v2/portfolio/summary`, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Fetch portfolio failed: ${response.status} - ${text}`);
    }

    const data = (await response.json()) as PortfolioSummaryResponse;

    return {
      accountValue: data.total_equity,
      marginUsed: data.total_equity, // because zhive currently support 1x so account value = margin
      withdrawable: 0,
      spotBalances: [
        {
          coin: 'USDC',
          token: 0,
          entryNtl: '0.0',
          hold: data.cash_balance.toFixed(5),
          total: data.cash_balance.toFixed(5),
        },
      ],
      positions: data.positions.map((position) => ({
        coin: position.token_id,
        side: position.net_size > 0 ? 'long' : 'short',
        size: Math.abs(position.net_size),
        entryPrice: position.avg_entry_price,
        pnl: position.unrealized_pnl,
        leverage: 1,
        // TODO: add this when api support
        liquidationPx: null,
      })),
    };
  }

  async fetchPositions(): Promise<DetailedPosition[]> {
    if (!this.apiKey) {
      throw new Error('api key is required');
    }

    const response = await fetch(`${this.baseUrl}/v2/portfolio/summary`, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Fetch portfolio failed: ${response.status} - ${text}`);
    }

    const data = (await response.json()) as PortfolioSummaryResponse;
    return data.positions.map((position) => ({
      coin: position.token_id,
      side: position.net_size > 0 ? 'long' : 'short',
      size: Math.abs(position.net_size),
      entryPrice: position.avg_entry_price,
      pnl: position.unrealized_pnl,
      leverage: 1,
      funding: 0,
      positionValueUsd: position.position_value,
      markPrice: position.current_price,
      unrealizedPnl: position.unrealized_pnl,
      // TODO: add this when api support
      liquidationPx: null,
      marginUsed: 0,
      roePercent: 0,
    }));
  }
}
