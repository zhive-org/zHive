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
    private apiKey: string,
    private info: InfoClient,
    private converter: SymbolConverter,
  ) {}

  static async create({
    baseUrl = HIVE_API_URL,
    apiKey,
  }: {
    baseUrl?: string;
    apiKey: string;
  }): Promise<ZhiveExchange> {
    const transport = new HttpTransport({ isTestnet: true });

    const info = new InfoClient({ transport });
    const converter = await SymbolConverter.create({ transport });

    return new ZhiveExchange(baseUrl, apiKey, info, converter);
  }

  async placeOrder(order: TradeDecision): Promise<ExecutionResult> {
    try {
      const assetId = this.converter.getAssetId(order.coin);
      if (_.isNil(assetId)) {
        return { coin: order.coin, action: order.action, success: false, details: 'Unknown asset' };
      }

      if (order.action === 'CLOSE') {
        return await this._executeMarketClose(order);
      }

      return await this._executeMarketOpen(order);
    } catch (err) {
      const result: ExecutionResult = {
        coin: order.coin,
        action: order.action,
        success: false,
        details: String(err),
      };
      return result;
    }
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
    const assetId = this.converter.getAssetId(d.coin);
    if (_.isNil(assetId)) {
      return { coin: d.coin, action: 'CLOSE', success: false, details: 'Unknown asset' };
    }

    const account = await this.fetchAccountState();
    const position = account.positions.find((p) => p.coin === d.coin);
    if (!position) {
      return { coin: d.coin, action: 'CLOSE', success: false, details: 'No position to close' };
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
      success: true,
      details: `Closed ${position.side} position`,
    };
  }

  private async _executeMarketOpen(order: TradeDecision): Promise<ExecutionResult> {
    const isBuy = order.action === 'LONG';
    // convert size from usd to currency unit
    const mids = await this.info.allMids();
    const szDecimal = this.converter.getSzDecimals(order.coin);
    if (!(order.coin in mids) || _.isNil(szDecimal)) {
      return {
        coin: order.coin,
        action: order.action,
        success: false,
        details: 'Failed to fetch order book',
      };
    }

    const entryPrice = parseFloat(mids[order.coin]);
    const size = order.sizeUsd / entryPrice;

    const req: {
      token_id: string;
      position_delta: string;
      stop_loss?: string;
      take_profit?: string;
    } = {
      token_id: order.coin,
      position_delta: formatSize(size * (isBuy ? 1 : -1), szDecimal),
    };

    if (order.sl) {
      const priceMovePct = order.sl / order.leverage / 100;
      // SL triggers when price moves against the position
      const triggerPrice = entryPrice * (isBuy ? 1 - priceMovePct : 1 + priceMovePct);
      req.stop_loss = formatPrice(triggerPrice, szDecimal);
    }

    if (order.tp) {
      const priceMovePct = order.tp / order.leverage / 100;
      const triggerPrice = entryPrice * (isBuy ? 1 + priceMovePct : 1 - priceMovePct);
      req.take_profit = formatPrice(triggerPrice, szDecimal);
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
      success: true,
      details: `Opened ${isBuy ? 'long' : 'short'} ~$${order.sizeUsd} at ${order.leverage}x (SL ${order.sl ?? '-'}% / TP ${order.tp ?? '-'}% PnL)`,
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
