import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { formatPrice, formatSize, SymbolConverter } from '@nktkas/hyperliquid/utils';
import { HiveClient } from '@zhive/sdk';
import _ from 'lodash';
import { HIVE_API_URL } from '../../config/constant';
import { HyperliquidService } from '../../hyperliquid/service';
import type {
  AccountSummary,
  DetailedPosition,
  ExecutionResult,
  PairInfo,
  TradeDecision,
} from '../types';
import { PositionNotFound, UnSupportedAssetError } from './error';
import { stopLossTriggerPrice, takeProfitTriggerPrice } from './tp-sl';
import type { IExchange, TradingCategory } from './types';
import type { ClosePositionRequest, OpenPositionRequest } from '@zhive/sdk';

export class ZhiveExchange implements IExchange {
  constructor(
    private hl: HyperliquidService,
    private converter: SymbolConverter,
    private hiveClient: HiveClient,
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
    const hl = new HyperliquidService(info);
    const converter = await SymbolConverter.create({ transport, dexs: true });
    const hiveClient = new HiveClient(baseUrl, apiKey);

    return new ZhiveExchange(hl, converter, hiveClient);
  }

  async getPairInfo(pair: string): Promise<PairInfo | null> {
    const parts = pair.split(':');
    let dex: string | undefined;
    if (parts.length === 2) {
      dex = parts[0];
    }

    const [meta, assetCtxs] = await this.hl.metaAndAssetCtxs({ dex });

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

  async placeOrder(order: TradeDecision): Promise<ExecutionResult> {
    const assetId = this.converter.getAssetId(order.asset);
    if (_.isNil(assetId)) {
      throw new UnSupportedAssetError();
    }

    if (order.action === 'CLOSE') {
      return await this._executeMarketClose(order);
    }

    return await this._executeMarketOpen(order);
  }

  async getAvailableTradingPairs(category?: TradingCategory): Promise<string[]> {
    const calls: Array<ReturnType<HyperliquidService['metaAndAssetCtxs']>> = [];
    if (category === undefined || category === 'crypto') {
      calls.push(this.hl.metaAndAssetCtxs());
    }
    if (category === undefined || category === 'stock-commodity') {
      calls.push(this.hl.metaAndAssetCtxs({ dex: 'xyz' }));
    }

    const results = await Promise.all(calls);

    const pairs: string[] = [];
    for (const [meta] of results) {
      for (const u of meta.universe) {
        if (!u.isDelisted) {
          pairs.push(u.name);
        }
      }
    }

    return pairs;
  }

  private async _executeMarketClose(d: TradeDecision): Promise<ExecutionResult> {
    const assetId = this.converter.getAssetId(d.asset);
    if (_.isNil(assetId)) {
      throw new UnSupportedAssetError();
    }

    const account = await this.fetchAccountState();
    const position = account.positions.find((p) => p.coin === d.asset);
    if (!position) {
      throw new PositionNotFound();
    }

    const isBuy = position.side === 'short';

    const reasoning = d.reasoning?.trim() || undefined;
    const req: ClosePositionRequest = {
      token_id: d.asset,
      position_delta: (position.size * (isBuy ? 1 : -1)).toString(),
      reasoning,
    };

    await this.hiveClient.trading.closeOrder(req);
    return {
      coin: d.asset,
      action: 'CLOSE',
      size: position.size.toString(),
    };
  }

  private async _executeMarketOpen(order: TradeDecision): Promise<ExecutionResult> {
    const isBuy = order.action === 'LONG';
    // convert size from usd to currency unit
    const dex = order.asset.includes(':') ? order.asset.split(':')[0] : undefined;
    const mids = await this.hl.allMids(dex ? { dex } : undefined);
    const szDecimal = this.converter.getSzDecimals(order.asset);
    if (!(order.asset in mids) || _.isNil(szDecimal)) {
      throw new UnSupportedAssetError();
    }

    const entryPrice = parseFloat(mids[order.asset]);
    const size = formatSize((order.sizeUsd / entryPrice) * (isBuy ? 1 : -1), szDecimal);

    const reasoning = order.reasoning?.trim() || undefined;
    const req: OpenPositionRequest = {
      token_id: order.asset,
      position_delta: size,
      reasoning,
    };

    let slPrice: string | undefined;
    let tpPrice: string | undefined;

    const side = isBuy ? 'long' : 'short';
    if (order.sl) {
      const triggerPrice = stopLossTriggerPrice(entryPrice, side, order.sl, order.leverage);
      slPrice = formatPrice(triggerPrice, szDecimal);
      req.stop_loss = slPrice;
    }

    if (order.tp) {
      const triggerPrice = takeProfitTriggerPrice(entryPrice, side, order.tp, order.leverage);
      tpPrice = formatPrice(triggerPrice, szDecimal);
      req.take_profit = tpPrice;
    }

    await this.hiveClient.trading.openOrder(req);
    return {
      coin: order.asset,
      action: order.action,
      size: Math.abs(Number(size)).toString(),
      slPrice,
      tpPrice,
    };
  }

  async fetchAccountState(): Promise<AccountSummary> {
    const data = await this.hiveClient.trading.getSelfPortfolioSummary();
    const marginUsed = data.positions.reduce((acc, p) => acc + p.position_value, 0);

    return {
      accountValue: data.total_equity,
      marginUsed: marginUsed,
      withdrawable: data.cash_balance,
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
    const data = await this.hiveClient.trading.getSelfPortfolioSummary();
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
