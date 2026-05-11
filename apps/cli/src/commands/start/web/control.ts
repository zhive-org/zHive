import type {
  AgentPortfolioRange,
  AgentPortfolioV2Dto,
  AgentTimeframe,
  AgentTradingStatsV2BatchEntryDto,
  ClosedTradesPageDto,
  ClosedTradesTimeframe,
  PositionsPageDto,
  Sentiment,
} from '@zhive/sdk';
import type { DetailedPosition } from '../../../shared/trading/types';

export type {
  AgentPortfolioRange,
  AgentPortfolioV2Dto,
  AgentTradingStatsV2BatchEntryDto,
  ClosedTradesPageDto,
  ClosedTradesTimeframe,
  PositionsPageDto,
};

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
  /** The provider env var the agent's currently using (e.g. `ANTHROPIC_API_KEY`),
   * derived from the agent's .env. `null` when no provider key is set in
   * the agent's local .env (the model loader falls back to shell-inherited
   * keys). Used by the credentials form to display the current provider. */
  providerEnvVar: string | null;
}

/** Subset of zhive-app's `AgentRankV2Dto` — the fields the dashboard renders. */
export interface AgentTradingRank {
  rank: number;
  total_trades: number;
  total_pnl_usd: number;
  roi_pct: number;
  win_rate_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  /** `null` means "no losses yet" (mongo can't store Infinity). Render as "∞". */
  profit_factor: number | null;
}

export interface AgentProfileResponse {
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  /** Public profile page on zhive.ai. */
  frontendUrl: string;
  /** `null` if the agent has never traded or the upstream rank API failed. */
  tradingRank: AgentTradingRank | null;
}

/** Mutable subset of the agent's structured config. `name` is intentionally
 * omitted (it identifies the agent and shouldn't change at runtime). */
export interface AgentConfigUpdate {
  bio?: string;
  avatarUrl?: string;
  watchList?: string[];
  sectors?: string[];
  sentiment?: Sentiment;
  timeframes?: AgentTimeframe[];
}

/** Credentials rotation. All fields optional — the caller can rotate just
 * the agent's apiKey, just the provider key, or both. */
export interface CredentialsUpdate {
  /** zHive agent API key written to `config.json`. */
  apiKey?: string;
  /** AI provider env var name (e.g. `ANTHROPIC_API_KEY`). */
  providerEnvVar?: string;
  /** Value for the provider env var. Written to `<agentDir>/.env`. */
  providerKey?: string;
}

export interface WebControl {
  executeCommand: (name: string) => Promise<void>;
  submitChat: (text: string) => Promise<void>;
  getState: () => Promise<WebState>;
  getAgentProfile: () => Promise<AgentProfileResponse>;
  /** Public portfolio snapshot + daily PnL series. Returns the upstream
   * `AgentPortfolioV2Dto` shape verbatim so the SPA can render the equity
   * card without server-side reshaping. */
  getAgentPortfolio: (range: AgentPortfolioRange) => Promise<AgentPortfolioV2Dto>;
  /** Live open-positions snapshot from `/v2/position/agent/:agentId`. */
  getAgentPositions: () => Promise<PositionsPageDto>;
  /** Closed-trades history from `/v2/order/trades/closed?agent_id=…`. */
  getAgentClosedTrades: (timeframe: ClosedTradesTimeframe) => Promise<ClosedTradesPageDto>;
  /** Merge a partial config into `config.json` and reload the runtime. */
  updateConfig: (partial: AgentConfigUpdate) => Promise<void>;
  /** Overwrite `SOUL.md` and reload the runtime. */
  updateSoul: (content: string) => Promise<void>;
  /** Overwrite `STRATEGY.md` and reload the runtime. */
  updateStrategy: (content: string) => Promise<void>;
  /** Rotate the agent's API key and/or AI provider key. */
  updateCredentials: (args: CredentialsUpdate) => Promise<void>;
}
