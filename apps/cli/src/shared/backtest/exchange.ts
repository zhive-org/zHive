import { HyperLiquidTimeframe } from '../tools/pinescript/providers/hyperliquid/timeframe';
import { RiskEngine } from '../trading/risk';
import { stopLossTriggerPrice, takeProfitTriggerPrice } from '../trading/exchange/tp-sl';
import {
  PositionFlipNotSupported,
  PositionNotFound,
  UnknownError,
  UnSupportedAssetError,
} from '../trading/exchange/error';
import { IExchange, TradingCategory } from '../trading/exchange/types';
import {
  AccountSummary,
  DetailedPosition,
  ExecutionResult,
  PairInfo,
  PositionInfo,
  TradeDecision,
} from '../trading/types';
import { CandleStore } from './candle-store';
import { BacktestClock } from './clock';
import { AccountSnapshot, FillRecord, RawCandle } from './types';

const DAY_MS = 86_400_000;

export interface BacktestExchangeOptions {
  initialCashUsd: number;
  slippage?: number; // fraction, e.g. 0.03 = 3%
  feeBps?: number; // taker fee, basis points
  risk?: RiskEngine;
}

interface OpenPosition {
  asset: string;
  side: 'long' | 'short';
  size: number; // base units, always positive
  entryPrice: number;
  leverage: number;
  slPrice: number | null;
  tpPrice: number | null;
  marginUsd: number; // collateral held against this position
  openedAt: number; // ms
}

const DEFAULT_SLIPPAGE = 0.03;
const DEFAULT_FEE_BPS = 2.5;

export class BacktestExchange implements IExchange {
  private cash: number;
  private positions = new Map<string, OpenPosition>();
  private fills: FillRecord[] = [];
  private slippage: number;
  private feeBps: number;
  private lastAdvanceMs: number;
  private risk?: RiskEngine;

  constructor(
    private clock: BacktestClock,
    private store: CandleStore,
    opts: BacktestExchangeOptions,
  ) {
    this.cash = opts.initialCashUsd;
    this.slippage = opts.slippage ?? DEFAULT_SLIPPAGE;
    this.feeBps = opts.feeBps ?? DEFAULT_FEE_BPS;
    this.risk = opts.risk;
    this.lastAdvanceMs = clock.now();
  }

  /**
   * Walk 1m candles from `lastAdvanceMs` up to `ts` and resolve TP/SL/liq
   * triggers for every open position. Pessimistic on straddle bars (SL wins).
   */
  async advanceTo(ts: number): Promise<void> {
    if (ts < this.lastAdvanceMs) return;

    for (const [, pos] of [...this.positions.entries()]) {
      if (pos.slPrice == null && pos.tpPrice == null) continue;

      const candles = await this.store.getCandles(
        pos.asset,
        HyperLiquidTimeframe['1m'],
        this.lastAdvanceMs,
        ts,
      );
      const trigger = findTriggerHit(pos, candles);
      if (trigger) {
        this._closeAt(pos, trigger.price, trigger.ts, trigger.kind);
      }
    }

    this.lastAdvanceMs = ts;
  }

  fills_(): readonly FillRecord[] {
    return this.fills;
  }

  async snapshot(): Promise<AccountSnapshot> {
    const ts = this.clock.now();
    const positions: AccountSnapshot['positions'] = [];
    let unrealizedTotal = 0;
    let marginUsed = 0;

    for (const pos of this.positions.values()) {
      const markPrice = (await this._markPrice(pos.asset, ts)) ?? pos.entryPrice;
      const unrealized = unrealizedPnl(pos, markPrice);
      unrealizedTotal += unrealized;
      marginUsed += pos.marginUsd;
      positions.push({
        asset: pos.asset,
        side: pos.side,
        size: pos.size,
        entryPrice: pos.entryPrice,
        markPrice,
        leverage: pos.leverage,
        unrealizedPnl: unrealized,
        slPrice: pos.slPrice,
        tpPrice: pos.tpPrice,
      });
    }

    return {
      ts,
      cash: this.cash,
      equity: this.cash + marginUsed + unrealizedTotal,
      marginUsed,
      positions,
    };
  }

  // ---------------- IExchange ----------------

  async placeOrder(order: TradeDecision): Promise<ExecutionResult> {
    if (order.action === 'HOLD') {
      throw new Error('HOLD should not reach placeOrder');
    }

    if (this.risk) {
      const account = await this.fetchAccountState();
      const validated = this.risk.validate(order, account);
      if (validated.action === 'HOLD') {
        throw new UnknownError(`Risk: ${validated.reasoning}`);
      }
      order = validated;
    }

    if (order.action === 'CLOSE') {
      return this._executeClose(order);
    }
    return this._executeOpen(order);
  }

  async getAvailableTradingPairs(_category?: TradingCategory): Promise<string[]> {
    return [];
  }

  async fetchAccountState(): Promise<AccountSummary> {
    const ts = this.clock.now();
    let marginUsed = 0;
    let unrealizedTotal = 0;
    const positions: PositionInfo[] = [];

    for (const pos of this.positions.values()) {
      const markPrice = (await this._markPrice(pos.asset, ts)) ?? pos.entryPrice;
      const unrealized = unrealizedPnl(pos, markPrice);
      unrealizedTotal += unrealized;
      marginUsed += pos.marginUsd;
      positions.push({
        coin: pos.asset,
        side: pos.side,
        size: pos.size,
        entryPrice: pos.entryPrice,
        pnl: unrealized,
        leverage: pos.leverage,
        liquidationPx: liquidationPrice(pos),
      });
    }

    const accountValue = this.cash + marginUsed + unrealizedTotal;
    return {
      accountValue,
      marginUsed,
      withdrawable: this.cash,
      spotBalances: [
        {
          coin: 'USDC',
          token: 0,
          entryNtl: '0.0',
          hold: this.cash.toFixed(5),
          total: this.cash.toFixed(5),
        },
      ],
      positions,
    };
  }

  async fetchPositions(): Promise<DetailedPosition[]> {
    const ts = this.clock.now();
    const out: DetailedPosition[] = [];
    for (const pos of this.positions.values()) {
      const markPrice = (await this._markPrice(pos.asset, ts)) ?? pos.entryPrice;
      const unrealized = unrealizedPnl(pos, markPrice);
      out.push({
        coin: pos.asset,
        side: pos.side,
        size: pos.size,
        entryPrice: pos.entryPrice,
        markPrice,
        positionValueUsd: pos.size * markPrice,
        unrealizedPnl: unrealized,
        roePercent: pos.marginUsd > 0 ? (unrealized / pos.marginUsd) * 100 : 0,
        liquidationPx: liquidationPrice(pos),
        marginUsed: pos.marginUsd,
        funding: 0,
        leverage: pos.leverage,
      });
    }
    return out;
  }

  async getPairInfo(pair: string): Promise<PairInfo | null> {
    const ts = this.clock.now();
    const mark = await this._markPrice(pair, ts);
    if (mark == null) return null;
    const prev = (await this._markPrice(pair, ts - DAY_MS)) ?? mark;
    const dayVol = await this._24hVolumeUsd(pair, ts);
    const funding = await this.store.getFundingRate(pair, ts);

    return {
      coin: pair,
      markPx: mark.toString(),
      midPx: mark.toString(),
      prevDayPx: prev.toString(),
      dayNtlVlm: dayVol.toString(),
      funding: funding.toString(),
      openInterest: '0',
    };
  }

  // ---------------- internals ----------------

  private async _executeOpen(order: TradeDecision): Promise<ExecutionResult> {
    const ts = this.clock.now();
    const isBuy = order.action === 'LONG';
    const newSide: 'long' | 'short' = isBuy ? 'long' : 'short';

    const mark = await this._markPrice(order.asset, ts);
    if (mark == null) throw new UnSupportedAssetError();

    const existing = this.positions.get(order.asset);
    if (existing && existing.side !== newSide) {
      throw new PositionFlipNotSupported();
    }

    const fillPrice = mark * (isBuy ? 1 + this.slippage : 1 - this.slippage);
    const sizeBase = order.sizeUsd / fillPrice;
    const marginUsd = order.sizeUsd / order.leverage;
    const fee = order.sizeUsd * (this.feeBps / 10_000);

    if (this.cash < marginUsd + fee) {
      throw new UnknownError(
        `Insufficient cash: need ${(marginUsd + fee).toFixed(2)}, have ${this.cash.toFixed(2)}`,
      );
    }

    this.cash -= marginUsd + fee;

    let pos: OpenPosition;
    if (existing) {
      // Same-side add: weighted-average entry, replace TP/SL with the new ones.
      const totalSize = existing.size + sizeBase;
      const avgEntry = (existing.entryPrice * existing.size + fillPrice * sizeBase) / totalSize;
      pos = {
        ...existing,
        size: totalSize,
        entryPrice: avgEntry,
        marginUsd: existing.marginUsd + marginUsd,
        leverage: order.leverage,
        slPrice: triggerOrNull(avgEntry, newSide, order.sl, order.leverage, 'sl'),
        tpPrice: triggerOrNull(avgEntry, newSide, order.tp, order.leverage, 'tp'),
      };
    } else {
      pos = {
        asset: order.asset,
        side: newSide,
        size: sizeBase,
        entryPrice: fillPrice,
        leverage: order.leverage,
        slPrice: triggerOrNull(fillPrice, newSide, order.sl, order.leverage, 'sl'),
        tpPrice: triggerOrNull(fillPrice, newSide, order.tp, order.leverage, 'tp'),
        marginUsd,
        openedAt: ts,
      };
    }

    this.positions.set(order.asset, pos);

    this.fills.push({
      ts,
      asset: order.asset,
      side: newSide,
      action: 'OPEN',
      size: sizeBase,
      price: fillPrice,
      notionalUsd: order.sizeUsd,
      feeUsd: fee,
      realizedPnlUsd: 0,
      reasoning: order.reasoning,
    });

    return {
      coin: order.asset,
      action: order.action,
      size: sizeBase.toString(),
      slPrice: pos.slPrice?.toString(),
      tpPrice: pos.tpPrice?.toString(),
    };
  }

  private async _executeClose(order: TradeDecision): Promise<ExecutionResult> {
    const pos = this.positions.get(order.asset);
    if (!pos) throw new PositionNotFound();

    const ts = this.clock.now();
    const mark = await this._markPrice(order.asset, ts);
    if (mark == null) throw new UnSupportedAssetError();

    const exitPrice = mark * (pos.side === 'long' ? 1 - this.slippage : 1 + this.slippage);
    this._closeAt(pos, exitPrice, ts, 'CLOSE_MANUAL', order.reasoning);

    return {
      coin: order.asset,
      action: 'CLOSE',
      size: pos.size.toString(),
    };
  }

  private _closeAt(
    pos: OpenPosition,
    exitPrice: number,
    ts: number,
    action: FillRecord['action'],
    reasoning: string = action,
  ): void {
    const realized = realizedPnl(pos, exitPrice);
    const fee = pos.size * exitPrice * (this.feeBps / 10_000);
    this.cash += pos.marginUsd + realized - fee;
    this.positions.delete(pos.asset);
    this.fills.push({
      ts,
      asset: pos.asset,
      side: pos.side,
      action,
      size: pos.size,
      price: exitPrice,
      notionalUsd: pos.size * exitPrice,
      feeUsd: fee,
      realizedPnlUsd: realized,
      reasoning,
    });
  }

  private async _markPrice(asset: string, ts: number): Promise<number | null> {
    // Prefer 1m granularity; fall back to 1h if 1m isn't available.
    const oneM = await this.store.getCandleAt(asset, HyperLiquidTimeframe['1m'], ts);
    if (oneM) return oneM.c;
    const oneH = await this.store.getCandleAt(asset, HyperLiquidTimeframe['1h'], ts);
    return oneH ? oneH.c : null;
  }

  private async _24hVolumeUsd(asset: string, ts: number): Promise<number> {
    const start = ts - DAY_MS;
    const candles = await this.store.getCandles(asset, HyperLiquidTimeframe['1h'], start, ts);
    return candles.reduce((acc, c) => acc + c.v * ((c.h + c.l + c.c) / 3), 0);
  }
}

function unrealizedPnl(pos: OpenPosition, markPrice: number): number {
  return pos.side === 'long'
    ? pos.size * (markPrice - pos.entryPrice)
    : pos.size * (pos.entryPrice - markPrice);
}

function realizedPnl(pos: OpenPosition, exitPrice: number): number {
  return unrealizedPnl(pos, exitPrice);
}

function liquidationPrice(pos: OpenPosition): number {
  // Simplified: liquidation when unrealized PnL ≈ -margin.
  // priceMove = -1 / leverage of entry.
  const move = 1 / pos.leverage;
  return pos.side === 'long' ? pos.entryPrice * (1 - move) : pos.entryPrice * (1 + move);
}

function triggerOrNull(
  entryPrice: number,
  side: 'long' | 'short',
  pnlPct: number | null | undefined,
  leverage: number,
  kind: 'sl' | 'tp',
): number | null {
  if (pnlPct == null || pnlPct === 0) return null;
  return kind === 'sl'
    ? stopLossTriggerPrice(entryPrice, side, pnlPct, leverage)
    : takeProfitTriggerPrice(entryPrice, side, pnlPct, leverage);
}

function findTriggerHit(
  pos: OpenPosition,
  candles: RawCandle[],
): { ts: number; price: number; kind: FillRecord['action'] } | null {
  for (const c of candles) {
    const slHit = checkSlHit(pos, c);
    const tpHit = checkTpHit(pos, c);
    // Pessimistic on straddle: SL wins when both could hit in the same bar.
    if (slHit) return { ts: c.t, price: pos.slPrice as number, kind: 'CLOSE_SL' };
    if (tpHit) return { ts: c.t, price: pos.tpPrice as number, kind: 'CLOSE_TP' };
  }
  return null;
}

function checkSlHit(pos: OpenPosition, c: RawCandle): boolean {
  if (pos.slPrice == null) return false;
  return pos.side === 'long' ? c.l <= pos.slPrice : c.h >= pos.slPrice;
}

function checkTpHit(pos: OpenPosition, c: RawCandle): boolean {
  if (pos.tpPrice == null) return false;
  return pos.side === 'long' ? c.h >= pos.tpPrice : c.l <= pos.tpPrice;
}
