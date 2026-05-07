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
