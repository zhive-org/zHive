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
