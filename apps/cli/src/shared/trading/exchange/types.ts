import type {
  AccountSummary,
  DetailedPosition,
  ExecutionResult,
  PairInfo,
  TradeDecision,
} from '../types';

export interface IExchange {
  placeOrder(order: TradeDecision): Promise<ExecutionResult>;

  getAvailableTradingPairs(): Promise<string[]>;

  fetchAccountState(): Promise<AccountSummary>;

  fetchPositions(): Promise<DetailedPosition[]>;

  getPairInfo(pair: string): Promise<PairInfo | null>;
}
