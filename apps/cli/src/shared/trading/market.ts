import { InfoClient } from '@nktkas/hyperliquid';
import { AccountSummary, AssetContext, AssetInfo, Candle, PositionInfo, Timeframe } from './types';
import { SymbolConverter } from '@nktkas/hyperliquid/utils';

export class MarketService {
  constructor(private info: InfoClient) {}

  async getAssetContext(name: string): Promise<AssetContext | undefined> {
    const parts = name.split(':');
    let dex: string | undefined;
    if (parts.length === 2) {
      dex = parts[0];
    }

    const [meta, assetCtxs] = await this.info.metaAndAssetCtxs({ dex });

    const assetIndex = meta.universe.findIndex((u) => u.name === name);
    if (assetIndex === -1) {
      return undefined;
    }

    const ctx = assetCtxs[assetIndex];
    return {
      coin: name,
      ...ctx,
    };
  }

  async fetchCandles(
    coin: string,
    interval: Timeframe,
    startTime: number,
    endTime: number,
  ): Promise<Candle[]> {
    const raw = await this.info.candleSnapshot({
      coin,
      interval,
      startTime,
      endTime,
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

  async fetchAccountState(address: `0x${string}`): Promise<AccountSummary> {
    const [state, spot] = await Promise.all([
      this.info.clearinghouseState({ user: address }),
      this.info.spotClearinghouseState({ user: address }),
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
}
