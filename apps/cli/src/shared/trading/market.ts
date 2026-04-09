import { InfoClient } from '@nktkas/hyperliquid';
import { AccountSummary, AssetContext, DetailedPosition, PositionInfo } from './types';
import type { Candle, Timeframe } from '../tools/pinescript';

export class HyperliquidMarketService {
  constructor(private info: InfoClient) {}

  async getAvailableAssets({ dex }: { dex?: string } = {}): Promise<string[]> {
    const [meta] = await this.info.metaAndAssetCtxs({ dex });
    return meta.universe.map((u) => u.name);
  }

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

  async fetchPositions(address: `0x${string}`): Promise<DetailedPosition[]> {
    const [state, mids] = await Promise.all([
      this.info.clearinghouseState({ user: address }),
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
