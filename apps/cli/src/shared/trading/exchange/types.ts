import { Candle, Timeframe } from '../../tools/pinescript';
import {
  AccountSummary,
  AssetContext,
  DetailedPosition,
  ExecutionResult,
  TradeDecision,
} from '../types';

export interface IExchange {
  placeOrder(order: TradeDecision): Promise<ExecutionResult>;

  getAvailableTradingPairs(): Promise<string[]>;

  getPairInfo(pair: string): Promise<AssetContext | null>;

  fetchCandles(
    pair: string,
    interval: Timeframe,
    sDate: number | Date,
    eDate: number | Date,
  ): Promise<Candle[]>;

  fetchAccountState(): Promise<AccountSummary>;

  fetchPositions(): Promise<DetailedPosition[]>;
}
