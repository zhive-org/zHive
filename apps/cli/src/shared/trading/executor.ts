import type { ExchangeClient, InfoClient } from '@nktkas/hyperliquid';
import type { TradeDecision, ExecutionResult, AssetInfo, AccountSummary } from './types.js';
import { formatPrice, formatSize, SymbolConverter } from '@nktkas/hyperliquid/utils';
import _ from 'lodash';

const SLIPPAGE = 0.03;

export class TradeExecutor {
  constructor(
    private exchange: ExchangeClient,
    private info: InfoClient,
    private converter: SymbolConverter,
  ) {}

  async execute(decision: TradeDecision, account: AccountSummary): Promise<ExecutionResult> {
    try {
      const result = await this.executeSingle(decision, account);
      return result;
    } catch (err) {
      const result: ExecutionResult = {
        coin: decision.coin,
        action: decision.action,
        success: false,
        details: String(err),
      };
      return result;
    }
  }

  private async executeSingle(d: TradeDecision, account: AccountSummary): Promise<ExecutionResult> {
    const assetId = this.converter.getAssetId(d.coin);
    if (_.isNil(assetId)) {
      return { coin: d.coin, action: d.action, success: false, details: 'Unknown asset' };
    }

    if (d.action === 'CLOSE') {
      return this.executeMarketClose(d, account);
    }

    return this.executeMarketOpen(d);
  }

  private async executeMarketClose(
    d: TradeDecision,
    account: AccountSummary,
  ): Promise<ExecutionResult> {
    const assetId = await this.converter.getAssetId(d.coin);
    if (_.isNil(assetId)) {
      return { coin: d.coin, action: 'CLOSE', success: false, details: 'Unknown asset' };
    }

    const position = account.positions.find((p) => p.coin === d.coin);
    if (!position) {
      return { coin: d.coin, action: 'CLOSE', success: false, details: 'No position to close' };
    }

    const isBuy = position.side === 'short';
    const mids = await this.info.allMids();
    const szDecimals = this.converter.getSzDecimals(d.coin);
    const mid = parseFloat(mids[d.coin]);
    if (_.isNil(mid) || _.isNil(szDecimals)) {
      return { coin: d.coin, action: 'CLOSE', success: false, details: 'Unknown asset' };
    }

    const price = mid * (isBuy ? 1 + SLIPPAGE : 1 - SLIPPAGE);
    const response = await this.exchange.order({
      orders: [
        {
          a: assetId,
          b: isBuy,
          p: formatPrice(price, szDecimals),
          s: formatSize(position.size, szDecimals),
          r: true,
          t: { limit: { tif: 'FrontendMarket' } },
        },
      ],
      grouping: 'na',
    });

    const status = response.response.data.statuses[0];
    if (typeof status === 'object' && status !== null && 'error' in status) {
      return { coin: d.coin, action: 'CLOSE', success: false, details: String(status.error) };
    }

    return {
      coin: d.coin,
      action: 'CLOSE',
      success: true,
      details: `Closed ${position.side} position`,
    };
  }

  private async executeMarketOpen(d: TradeDecision): Promise<ExecutionResult> {
    const isBuy = d.action === 'OPEN_LONG';

    const assetId = this.converter.getAssetId(d.coin);
    if (_.isNil(assetId)) {
      return { coin: d.coin, action: d.action, success: false, details: 'Unknown asset' };
    }

    await this.exchange.updateLeverage({
      asset: assetId,
      isCross: true,
      leverage: d.leverage,
    });

    const mids = await this.info.allMids();
    const szDecimal = this.converter.getSzDecimals(d.coin);
    if (!(d.coin in mids) || _.isNil(szDecimal)) {
      return {
        coin: d.coin,
        action: d.action,
        success: false,
        details: 'Failed to fetch order book',
      };
    }
    const mid = parseFloat(mids[d.coin]);
    const price = mid * (isBuy ? 1 + SLIPPAGE : 1 - SLIPPAGE);

    const response = await this.exchange.order({
      orders: [
        {
          a: assetId,
          b: isBuy,
          p: formatPrice(price, szDecimal),
          s: formatSize(d.sizeUsd, szDecimal),
          r: false,
          t: { limit: { tif: 'FrontendMarket' } },
        },
      ],
      grouping: 'na',
    });

    const status = response.response.data.statuses[0];
    if (typeof status === 'object' && status !== null && 'error' in status) {
      return { coin: d.coin, action: d.action, success: false, details: String(status.error) };
    }

    return {
      coin: d.coin,
      action: d.action,
      success: true,
      details: `Opened ${isBuy ? 'long' : 'short'} ~$${d.sizeUsd} at ${d.leverage}x`,
    };
  }
}
