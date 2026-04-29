import { HyperLiquidTimeframe } from '../tools/pinescript/providers/hyperliquid/timeframe';

export interface RawCandle {
  t: number; // open time (ms)
  T: number; // close time (ms)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number; // number of trades
}

export type Interval = HyperLiquidTimeframe;

export interface FillRecord {
  ts: number;
  asset: string;
  side: 'long' | 'short';
  action: 'OPEN' | 'CLOSE_MANUAL' | 'CLOSE_TP' | 'CLOSE_SL';
  size: number; // base units
  price: number;
  notionalUsd: number;
  feeUsd: number;
  realizedPnlUsd: number;
  reasoning: string;
}

export interface AccountSnapshot {
  ts: number;
  cash: number;
  equity: number; // cash + sum(unrealized)
  marginUsed: number;
  positions: Array<{
    asset: string;
    side: 'long' | 'short';
    size: number;
    entryPrice: number;
    markPrice: number;
    leverage: number;
    unrealizedPnl: number;
    slPrice: number | null;
    tpPrice: number | null;
  }>;
}
