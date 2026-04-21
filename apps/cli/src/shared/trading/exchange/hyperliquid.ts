import { ExchangeClient, HttpTransport, InfoClient, OrderParameters } from '@nktkas/hyperliquid';
import { IExchange } from './types';
import { formatPrice, formatSize, SymbolConverter } from '@nktkas/hyperliquid/utils';
import { Timeframe, Candle } from '../../tools/pinescript';
import {
  TradeDecision,
  ExecutionResult,
  PairInfo,
  AccountSummary,
  DetailedPosition,
  PositionInfo,
} from '../types';
import _ from 'lodash';
import { privateKeyToAccount } from 'viem/accounts';
import { PositionNotFound, UnknownError, UnSupportedAssetError } from './error';

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
    const assetId = this.converter.getAssetId(order.coin);
    if (_.isNil(assetId)) {
      throw new UnSupportedAssetError();
    }

    if (order.action === 'CLOSE') {
      return await this._executeMarketClose(order);
    }

    return await this._executeMarketOpen(order);
  }

  private async _executeMarketClose(d: TradeDecision): Promise<ExecutionResult> {
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
    const mids = await this.info.allMids();
    const szDecimals = this.converter.getSzDecimals(d.coin);
    const mid = mids[d.coin];
    if (_.isNil(mid) || _.isNil(szDecimals)) {
      throw new UnSupportedAssetError();
    }

    const size = formatSize(position.size, szDecimals);
    const price = parseFloat(mid) * (isBuy ? 1 + this.slippage : 1 - this.slippage);
    const response = await this.exchange.order({
      orders: [
        {
          a: assetId,
          b: isBuy,
          p: formatPrice(price, szDecimals),
          s: size,
          r: true,
          t: { limit: { tif: 'FrontendMarket' } },
        },
      ],
      grouping: 'na',
    });

    const status = response.response.data.statuses[0];
    if (typeof status === 'object' && status !== null && 'error' in status) {
      throw new UnknownError(String(status.error));
    }

    return {
      coin: d.coin,
      action: 'CLOSE',
      size,
    };
  }

  private async _executeMarketOpen(d: TradeDecision): Promise<ExecutionResult> {
    const isBuy = d.action === 'LONG';
    const assetId = this.converter.getAssetId(d.coin);
    if (_.isNil(assetId)) {
      throw new UnSupportedAssetError();
    }

    await this.exchange.updateLeverage({
      asset: assetId,
      isCross: true,
      leverage: d.leverage,
    });

    const mids = await this.info.allMids();
    const szDecimal = this.converter.getSzDecimals(d.coin);
    if (!(d.coin in mids) || _.isNil(szDecimal)) {
      throw new UnSupportedAssetError();
    }

    const mid = parseFloat(mids[d.coin]);
    const entryPrice = mid * (isBuy ? 1 + this.slippage : 1 - this.slippage);
    const size = formatSize(d.sizeUsd / entryPrice, szDecimal);

    const orders: OrderParameters['orders'] = [
      {
        a: assetId,
        b: isBuy,
        p: formatPrice(entryPrice, szDecimal),
        s: size,
        r: false,
        t: { limit: { tif: 'FrontendMarket' } },
      },
    ];

    let slPrice: string | undefined;
    let tpPrice: string | undefined;

    if (!_.isNil(d.sl)) {
      const priceMovePct = d.sl / d.leverage / 100;
      // SL triggers when price moves against the position
      const triggerPrice = entryPrice * (isBuy ? 1 - priceMovePct : 1 + priceMovePct);
      // Limit price is worse than trigger to ensure fill on market trigger
      const limitPrice = triggerPrice * (isBuy ? 1 - this.slippage : 1 + this.slippage);
      orders.push({
        a: assetId,
        b: !isBuy,
        p: formatPrice(limitPrice, szDecimal),
        s: size,
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

    if (!_.isNil(d.tp)) {
      // Convert PnL % to price move %, accounting for leverage.
      // PnL% = priceMove% * leverage  =>  priceMove% = PnL% / leverage
      const tpPriceMovePct = d.tp / d.leverage / 100;
      // TP triggers when price moves in favor of the position
      const triggerPrice = entryPrice * (isBuy ? 1 + tpPriceMovePct : 1 - tpPriceMovePct);
      // Limit price is worse than trigger to ensure fill
      const limitPrice = triggerPrice * (isBuy ? 1 - this.slippage : 1 + this.slippage);
      orders.push({
        a: assetId,
        b: !isBuy,
        p: formatPrice(limitPrice, szDecimal),
        s: size,
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
      throw new UnknownError(String(status.error));
    }

    return {
      coin: d.coin,
      action: d.action,
      size,
      slPrice,
      tpPrice,
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

  async getPairInfo(pair: string): Promise<PairInfo | null> {
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
