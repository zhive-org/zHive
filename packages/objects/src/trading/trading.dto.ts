/**
 * Per-agent trading stats backed by `agent_leaderboard_2`. Rank is intentionally
 * excluded — see `AgentRankV2Dto` for the rank-bearing single-agent variant.
 */
export interface AgentTradingStatsV2Dto {
  agent_id: string;
  total_trades: number;
  total_pnl_usd: number;
  roi_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  /**
   * Ratio of gross profit to gross loss. `null` means "no losses yet" —
   * render as "∞" client-side (BSON can't store Infinity, so it's normalized).
   */
  profit_factor: number | null;
  avg_hold_duration_ms: number;
}
/**
 * Rank + stats row backed by `agent_leaderboard_2`. Used by the trading-arena
 * UI (behind the `realWorldTradingEnabled` flag). The v1 `AgentRankDto` above
 * remains the contract for the prediction-based production UI.
 */
export interface AgentRankV2Dto extends AgentTradingStatsV2Dto {
  rank: number;
}
export interface AgentTradingStatsV2BatchEntryDto extends AgentTradingStatsV2Dto {
  agent_name: string;
}

export interface PositionSummary {
  token_id: string;
  net_size: number;
  avg_entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  position_value: number;
  stop_loss?: number;
  take_profit?: number;
}

export interface PortfolioSummary {
  cash_balance: number;
  positions: PositionSummary[];
  total_unrealized_pnl: number;
  total_equity: number;
}

export interface AgentDailyPnlV2EntryDto {
  date: string;
  realized_pnl_usd: number;
  unrealized_pnl_usd: number;
}

/**
 * Server-composed agent portfolio snapshot. Mirrors the upstream
 * `/v2/portfolio/agent/:agentId` response: headline numbers
 * (`current_equity_usd`, `all_time_pnl_usd`) include current unrealized PnL
 * marked at live Hyperliquid mids; `daily_pnl` is realized-only — the client
 * cumulates on top of `starting_equity_usd`.
 */
export interface AgentPortfolioV2Dto {
  agent_id: string;
  starting_equity_usd: number;
  current_equity_usd: number;
  all_time_pnl_usd: number;
  open_position_count: number;
  total_trades: number;
  daily_pnl: AgentDailyPnlV2EntryDto[];
}

export type AgentPortfolioRange = '7d' | '30d' | '90d' | 'all';

export type PositionDirection = 'long' | 'short';

/**
 * Per-position row returned by `/v2/position/agent/:agentId`. `direction`
 * is normalized server-side from net_size sign; `current_price` /
 * `unrealized_pnl` / `pct_change` are null when Hyperliquid has no live
 * price for the token at request time.
 */
export interface PositionEntryDto {
  id: string;
  token_id: string;
  direction: PositionDirection;
  /** Always positive — display size */
  size: number;
  avg_entry_price: number;
  current_price: number | null;
  unrealized_pnl: number | null;
  /** Decimal — multiply by 100 for percent display. */
  pct_change: number | null;
  stop_loss?: number;
  take_profit?: number;
  updated_at: string;
}

export interface PositionsPageDto {
  entries: PositionEntryDto[];
  next_cursor: string | null;
}

export type ClosedTradeDirection = 'long' | 'short';

/**
 * Row returned by `/v2/order/trades/closed?agent_id=:id`. `roe_pct` is a
 * decimal (e.g. 0.12 = +12%). `open_reasoning` is from the first open in
 * the chain — not necessarily the extension closest to this close.
 */
export interface ClosedTradeDto {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_avatar_url?: string;
  token_id: string;
  direction: ClosedTradeDirection;
  quantity: number;
  entry_price: number;
  exit_price: number;
  realized_pnl: number;
  roe_pct: number;
  hold_duration_ms: number;
  open_reasoning?: string;
  close_reasoning?: string;
  opened_at: string;
  closed_at: string;
}

export interface ClosedTradesPageDto {
  entries: ClosedTradeDto[];
  next_cursor: string | null;
}

export type ClosedTradesTimeframe = '24h' | '7d' | '30d' | 'all';

export interface OpenPositionRequest {
  token_id: string;

  /**
   * Positive = long, negative = short. Unit = the token.
   */
  position_delta: string;

  stop_loss?: string;

  take_profit?: string;

  reasoning?: string;
}

export interface ClosePositionRequest {
  token_id: string;

  /**
   * How much to close. Sign should be opposite of the open.
   * e.g. if long 5, send -5 (or -7, will be clamped to -5).
   */
  position_delta: string;

  reasoning?: string;
}
