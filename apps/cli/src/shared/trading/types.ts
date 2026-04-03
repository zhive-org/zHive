export interface StrategyConfig {
  name: string;
  description: string;
}

export interface AssetContext {
  coin: string;
  markPx: string;
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  midPx: string | null;
}

export interface PositionInfo {
  coin: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  pnl: number;
  leverage: number;
  liquidationPx: number | null;
}

export interface SpotBalance {
  coin: string;
  token: number;
  total: string;
  hold: string;
  entryNtl: string;
}

export interface AccountSummary {
  spotBalances: SpotBalance[];
  accountValue: number;
  marginUsed: number;
  withdrawable: number;
  positions: PositionInfo[];
}

export interface TradeDecision {
  coin: string;
  action: 'LONG' | 'SHORT' | 'CLOSE' | 'HOLD';
  sizeUsd: number;
  leverage: number;
  reasoning: string;
}

export interface AssetInfo {
  name: string;
  assetId: number;
  szDecimals: number;
  maxLeverage: number;
}

export interface ExecutionResult {
  coin: string;
  action: string;
  success: boolean;
  details: string;
}
