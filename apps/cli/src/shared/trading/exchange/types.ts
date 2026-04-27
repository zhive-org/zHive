import type {
  AccountSummary,
  DetailedPosition,
  ExecutionResult,
  PairInfo,
  TradeDecision,
} from '../types';

export type TradingCategory = 'crypto' | 'stock-commodity';

export interface IExchange {
  placeOrder(order: TradeDecision): Promise<ExecutionResult>;

  getAvailableTradingPairs(category?: TradingCategory): Promise<string[]>;

  fetchAccountState(): Promise<AccountSummary>;

  fetchPositions(): Promise<DetailedPosition[]>;

  getPairInfo(pair: string): Promise<PairInfo | null>;
}
