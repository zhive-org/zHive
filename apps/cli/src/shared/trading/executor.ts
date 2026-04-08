import type { ExchangeClient, InfoClient, OrderParameters } from '@nktkas/hyperliquid';
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
    const assetId = this.converter.getAssetId(d.coin);
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
    const mid = mids[d.coin];
    if (_.isNil(mid) || _.isNil(szDecimals)) {
      return { coin: d.coin, action: 'CLOSE', success: false, details: 'Unknown asset' };
    }

    const price = parseFloat(mid) * (isBuy ? 1 + SLIPPAGE : 1 - SLIPPAGE);
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
    const isBuy = d.action === 'LONG';
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
    const entryPrice = mid * (isBuy ? 1 + SLIPPAGE : 1 - SLIPPAGE);
    const size = d.sizeUsd / entryPrice;

    // Convert PnL % to price move %, accounting for leverage.
    // PnL% = priceMove% * leverage  =>  priceMove% = PnL% / leverage
    const slPriceMovePct = !_.isNil(d.sl) ? d.sl / d.leverage / 100 : null;
    const tpPriceMovePct = !_.isNil(d.tp) ? d.tp / d.leverage / 100 : null;

    const orders: OrderParameters['orders'] = [
      {
        a: assetId,
        b: isBuy,
        p: formatPrice(entryPrice, szDecimal),
        s: formatSize(size, szDecimal),
        r: false,
        t: { limit: { tif: 'FrontendMarket' } },
      },
    ];

    if (!_.isNil(slPriceMovePct)) {
      // SL triggers when price moves against the position
      const triggerPrice = entryPrice * (isBuy ? 1 - slPriceMovePct : 1 + slPriceMovePct);
      // Limit price is worse than trigger to ensure fill on market trigger
      const limitPrice = triggerPrice * (isBuy ? 1 - SLIPPAGE : 1 + SLIPPAGE);
      orders.push({
        a: assetId,
        b: !isBuy,
        p: formatPrice(limitPrice, szDecimal),
        s: formatSize(size, szDecimal),
        r: true,
        t: {
          trigger: {
            isMarket: true,
            tpsl: 'sl',
            triggerPx: formatPrice(triggerPrice, szDecimal),
          },
        },
      });
    }

    if (!_.isNil(tpPriceMovePct)) {
      // TP triggers when price moves in favor of the position
      const triggerPrice = entryPrice * (isBuy ? 1 + tpPriceMovePct : 1 - tpPriceMovePct);
      // Limit price is worse than trigger to ensure fill
      const limitPrice = triggerPrice * (isBuy ? 1 - SLIPPAGE : 1 + SLIPPAGE);
      orders.push({
        a: assetId,
        b: !isBuy,
        p: formatPrice(limitPrice, szDecimal),
        s: formatSize(size, szDecimal),
        r: true,
        t: {
          trigger: {
            isMarket: true,
            tpsl: 'tp',
            triggerPx: formatPrice(triggerPrice, szDecimal),
          },
        },
      });
    }

    const response = await this.exchange.order({
      orders,
      grouping: orders.length > 1 ? 'normalTpsl' : 'na',
    });

    const status = response.response.data.statuses[0];
    if (typeof status === 'object' && status !== null && 'error' in status) {
      return { coin: d.coin, action: d.action, success: false, details: String(status.error) };
    }

    return {
      coin: d.coin,
      action: d.action,
      success: true,
      details: `Opened ${isBuy ? 'long' : 'short'} ~$${d.sizeUsd} at ${d.leverage}x (SL ${d.sl ?? '-'}% / TP ${d.tp ?? '-'}% PnL)`,
    };
  }
}
