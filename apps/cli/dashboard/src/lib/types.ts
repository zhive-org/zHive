export type WebEventPayload =
  | { type: 'message'; text: string }
  | { type: 'error'; errorMessage: string }
  | {
      type: 'decision';
      action: 'LONG' | 'SHORT' | 'CLOSE' | 'HOLD';
      asset: string;
      reasoning: string;
      sizeUsd?: number;
      /** Mid/mark the runtime fed into the evaluator. May be undefined for
       * synthesized HOLDs (no LLM call) or pre-feature events. */
      priceUsed?: number;
    }
  | { type: 'online'; name: string; bio: string }
  | { type: 'chat'; role: 'user' | 'agent' | 'error' | 'tool'; text: string }
  | { type: 'system'; kind: 'clear-chat' };

export type WebEvent = { seq: number; timestamp: string } & WebEventPayload;

export interface WebEventsSince {
  events: WebEvent[];
  latest: number;
  oldestSeq: number;
  /** Increments whenever the server bus resets (agent boundary). SPA must
   * drop its `since` cursor on mismatch — otherwise the new agent's first
   * events are filtered out by an old, larger cursor. */
  generation: number;
}

export interface DetailedPosition {
  coin: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number | null;
  positionValueUsd: number;
  unrealizedPnl: number;
  roePercent: number;
  liquidationPx: number | null;
  marginUsed: number;
  funding: number;
  leverage: number;
}

export type Sentiment = 'very-bullish' | 'bullish' | 'neutral' | 'bearish' | 'very-bearish';
export type AgentTimeframe = '4h' | '24h' | '7d';

export interface WebState {
  agentName: string;
  bio: string | null;
  avatarUrl: string | null;
  watchlist: string[];
  positions: DetailedPosition[];
  memory: string;
  /** Personality markdown (`SOUL.md` body). */
  soulContent: string;
  /** Strategy markdown (`STRATEGY.md` body). */
  strategyContent: string;
  sectors: string[];
  sentiment: Sentiment;
  timeframes: AgentTimeframe[];
  /** Active provider env var (e.g. `ANTHROPIC_API_KEY`) or `null` when the
   * agent inherits a key from the user's shell instead of declaring its own. */
  providerEnvVar: string | null;
}

export interface AgentConfigUpdate {
  bio?: string;
  avatarUrl?: string;
  watchList?: string[];
  sectors?: string[];
  sentiment?: Sentiment;
  timeframes?: AgentTimeframe[];
}

export interface CredentialsUpdate {
  apiKey?: string;
  providerEnvVar?: string;
  providerKey?: string;
}

export interface PickerAgentSummary {
  name: string;
  /** ISO 8601 timestamp. */
  created: string;
  bio: string | null;
  avatarUrl?: string;
}

/** Per-agent trading stats for the picker UI. Mirrors the upstream
 * `AgentTradingStatsV2BatchEntryDto`. Missing/zero stats means the agent
 * isn't on the leaderboard yet (needs ≥5 closed trades to settle). */
export interface PickerAgentStats {
  agent_id: string;
  agent_name: string;
  total_trades: number;
  total_pnl_usd: number;
  roi_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  profit_factor: number | null;
  avg_hold_duration_ms: number;
}

/** Stats keyed by agent name. `null` means the agent has no leaderboard
 * entry yet — picker renders an empty-stats slot. */
export type PickerAgentsStats = Record<string, PickerAgentStats | null>;

export interface AgentDailyPnlEntry {
  date: string;
  realized_pnl_usd: number;
  unrealized_pnl_usd: number;
}

/** Server-composed portfolio snapshot. Headline numbers include current
 * unrealized PnL; `daily_pnl` is realized-only and the client cumulates
 * it on top of `starting_equity_usd`. */
export interface AgentPortfolio {
  agent_id: string;
  starting_equity_usd: number;
  current_equity_usd: number;
  all_time_pnl_usd: number;
  open_position_count: number;
  total_trades: number;
  daily_pnl: AgentDailyPnlEntry[];
}

export type PortfolioRange = '7d' | '30d' | '90d' | 'all';

export type PositionDirection = 'long' | 'short';

export interface PositionEntry {
  id: string;
  token_id: string;
  direction: PositionDirection;
  size: number;
  avg_entry_price: number;
  current_price: number | null;
  unrealized_pnl: number | null;
  /** Decimal — multiply by 100 for percent. */
  pct_change: number | null;
  stop_loss?: number;
  take_profit?: number;
  updated_at: string;
}

export interface PositionsPage {
  entries: PositionEntry[];
  next_cursor: string | null;
}

export interface ClosedTradeEntry {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_avatar_url?: string;
  token_id: string;
  direction: PositionDirection;
  quantity: number;
  entry_price: number;
  exit_price: number;
  realized_pnl: number;
  /** Decimal — multiply by 100 for percent. */
  roe_pct: number;
  hold_duration_ms: number;
  open_reasoning?: string;
  close_reasoning?: string;
  opened_at: string;
  closed_at: string;
}

export interface ClosedTradesPage {
  entries: ClosedTradeEntry[];
  next_cursor: string | null;
}

export type ClosedTradesTimeframe = '24h' | '7d' | '30d' | 'all';

export interface AgentTradingRank {
  rank: number;
  total_trades: number;
  total_pnl_usd: number;
  roi_pct: number;
  win_rate_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  profit_factor: number | null;
}

export interface AgentProfile {
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  frontendUrl: string;
  tradingRank: AgentTradingRank | null;
}

export type ApiState =
  | ({ phase: 'ready' } & WebState)
  | { phase: 'selecting'; agents: PickerAgentSummary[] }
  | { phase: 'starting'; agents: PickerAgentSummary[] };
