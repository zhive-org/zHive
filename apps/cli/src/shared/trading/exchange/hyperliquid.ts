import { ExchangeClient, HttpTransport, InfoClient, OrderParameters } from '@nktkas/hyperliquid';
import { IExchange } from './types';
import { formatPrice, formatSize, SymbolConverter } from '@nktkas/hyperliquid/utils';
import { Timeframe, Candle } from '../../tools/pinescript';
import {
  TradeDecision,
  ExecutionResult,
  AssetContext,
  AccountSummary,
  DetailedPosition,
  PositionInfo,
} from '../types';
import _ from 'lodash';
import { privateKeyToAccount } from 'viem/accounts';

const DEFAULT_SLIPPAGE = 0.03;

export class HyperliquidExchange implements IExchange {
  constructor(
    private walletAddress: `0x${string}`,
    private exchange: ExchangeClient,
    private info: InfoClient,
    private converter: SymbolConverter,
    private slippage: number = DEFAULT_SLIPPAGE,
  ) {}

  static async create({
    walletAddress,
    privateKey,
    slippage,
  }: {
    walletAddress?: `0x${string}`;
    privateKey?: `0x${string}`;
    slippage?: number;
  } = {}): Promise<HyperliquidExchange> {
    privateKey ??= process.env.PRIVATE_KEY as `0x${string}`;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not set');
    }
    walletAddress ??= process.env.WALLET_ADDRESS as `0x${string}`;
    if (!walletAddress) {
      throw new Error(`WALLET_ADDRESS not set`);
    }

    const transport = new HttpTransport({ isTestnet: true });
    const wallet = privateKeyToAccount(privateKey);

    const info = new InfoClient({ transport });
    const exchange = new ExchangeClient({ transport, wallet });
    const converter = await SymbolConverter.create({ transport });

    return new HyperliquidExchange(walletAddress, exchange, info, converter, slippage);
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
    const mids = await this.info.allMids();
    const szDecimals = this.converter.getSzDecimals(d.coin);
    const mid = mids[d.coin];
    if (_.isNil(mid) || _.isNil(szDecimals)) {
      return { coin: d.coin, action: 'CLOSE', success: false, details: 'Unknown asset' };
    }

    const price = parseFloat(mid) * (isBuy ? 1 + this.slippage : 1 - this.slippage);
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

  private async _executeMarketOpen(d: TradeDecision): Promise<ExecutionResult> {
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
    const entryPrice = mid * (isBuy ? 1 + this.slippage : 1 - this.slippage);
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
      const limitPrice = triggerPrice * (isBuy ? 1 - this.slippage : 1 + this.slippage);
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
      const limitPrice = triggerPrice * (isBuy ? 1 - this.slippage : 1 + this.slippage);
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
    const [state, spot] = await Promise.all([
      this.info.clearinghouseState({ user: this.walletAddress }),
      this.info.spotClearinghouseState({ user: this.walletAddress }),
    ]);

    const positions: PositionInfo[] = state.assetPositions
      .filter((p) => parseFloat(p.position.szi) !== 0)
      .map((p) => {
        const szi = parseFloat(p.position.szi);
        return {
          coin: p.position.coin,
          side: szi > 0 ? ('long' as const) : ('short' as const),
          size: Math.abs(szi),
          entryPrice: parseFloat(p.position.entryPx),
          pnl: parseFloat(p.position.unrealizedPnl),
          leverage: p.position.leverage.value,
          liquidationPx: p.position.liquidationPx ? parseFloat(p.position.liquidationPx) : null,
        };
      });

    return {
      spotBalances: spot.balances,
      accountValue: parseFloat(state.marginSummary.accountValue),
      marginUsed: parseFloat(state.marginSummary.totalMarginUsed),
      withdrawable: parseFloat(state.withdrawable),
      positions,
    };
  }

  async fetchPositions(): Promise<DetailedPosition[]> {
    const [state, mids] = await Promise.all([
      this.info.clearinghouseState({ user: this.walletAddress }),
      this.info.allMids(),
    ]);

    return state.assetPositions
      .filter((p) => parseFloat(p.position.szi) !== 0)
      .map((p) => {
        const szi = parseFloat(p.position.szi);
        const mark = mids[p.position.coin];
        return {
          coin: p.position.coin,
          side: szi > 0 ? ('long' as const) : ('short' as const),
          size: Math.abs(szi),
          entryPrice: parseFloat(p.position.entryPx),
          markPrice: mark ? parseFloat(mark) : null,
          positionValueUsd: parseFloat(p.position.positionValue),
          unrealizedPnl: parseFloat(p.position.unrealizedPnl),
          roePercent: parseFloat(p.position.returnOnEquity) * 100,
          liquidationPx: p.position.liquidationPx ? parseFloat(p.position.liquidationPx) : null,
          marginUsed: parseFloat(p.position.marginUsed),
          funding: parseFloat(p.position.cumFunding.sinceOpen),
          leverage: p.position.leverage.value,
        };
      });
  }
}
