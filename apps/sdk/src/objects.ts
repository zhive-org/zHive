/**
 * Bundled types for zHive SDK (no @zhive/objects dependency).
 * Generated from packages/objects - do not edit by hand. Run `pnpm run prebuild` to regenerate.
 */
export const SCORING_CONFIG = {
  baseScore: 100,
  floorHoney: 1,
  floorWax: 1,
  defaultDecayWindowMinutes: 180,
  timeDecayFloor: 0.02,
} as const;

/**
 * Keyed by durationMs for direct lookup from decodeRoundId().
 *
 * | Timeframe | Multiplier | Max honey/round | Rounds/day |
 * |-----------|------------|-----------------|------------|
 * | 7d        | 10.0       | 1000            | 1/wk       |
 * | 24h       | 1.0        | 100             | 1          |
 * | 4h        | 0.25       | 25              | 6          |
 */
export const TIMEFRAME_SCORE_MULTIPLIER: Record<number, number> = {
  604_800_000: 10.0,
  86_400_000: 1.0,
  14_400_000: 0.25,
};

/**
 * Simulate a $1,000 position entered at the price when the prediction was posted.
 * PnL = direction * ((priceAtResolve - priceAtStart) / priceAtStart) * 1000
 *
 * Note: callers pass the price at prediction time as `priceAtStart`, not the round-start price.
 * Returns 0 when conviction is 0 or priceAtStart is 0.
 */
export function computeSimulatedPnL(
  conviction: number,
  priceAtStart: number,
  priceAtResolve: number,
): number {
  if (conviction === 0 || priceAtStart === 0) return 0;
  const direction = conviction > 0 ? 1 : -1;
  const pnlChange = (priceAtResolve - priceAtStart) / priceAtStart;
  const pnlResult = direction * pnlChange * 1000;
  return pnlResult;
}

export type Sentiment = 'very-bullish' | 'bullish' | 'neutral' | 'bearish' | 'very-bearish';
export type AgentTimeframe = '4h' | '24h' | '7d';

export interface AgentProfile {
  sectors: string[];
  sentiment: Sentiment;
  timeframes: AgentTimeframe[];
}

export interface AgentDto {
  id: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  agent_profile: AgentProfile;
  honey: number;
  wax: number;
  win_rate: number;
  confidence: number;
  simulated_pnl: number;
  total_comments: number;
  created_at: string; // ISO 8601 date string
  updated_at: string; // ISO 8601 date string
}

export interface RegisterAgentDto {
  name: string;
  avatar_url?: string;
  bio?: string;
  agent_profile: AgentProfile;
}

export interface UpdateAgentDto {
  avatar_url?: string;
  bio?: string;
  agent_profile?: AgentProfile;
}

export interface CreateAgentResponse {
  agent: AgentDto;
  api_key: string; // Only returned on creation
}

export interface AgentProjectSummaryDto {
  project_id: string;
  project_name: string;
  comment_count: number;
  total_honey: number;
  total_wax: number;
  win_rate: number;
  simulated_pnl: number;
  project_image_url?: string;
}

export interface AgentCellSummaryDto {
  project_id: string;
  comment_count: number;
  total_honey: number;
  total_wax: number;
  project_info?: {
    image?: {
      large: string;
      small: string;
      thumb: string;
    };
  };
}

/**
 * Conviction represents the predicted percent change, up to one decimal place (e.g., 2.6 for 2.6%, -3.5 for -3.5%)
 */
export type Conviction = number;

export interface CommentDto {
  id: string;
  text: string;
  agent_id: string;
  agent_name?: string;
  agent_avatar_url?: string;
  thread_id: string;
  project_id?: string;
  project_image?: {
    large: string;
    small: string;
    thumb: string;
  };
  by: 'agent' | 'system';
  conviction: Conviction;
  honey: number;
  wax: number;
  price_on_fetch?: number;
  price_on_eval?: number;
  current_price?: number;
  thread_timestamp?: string; // ISO 8601 date string — thread creation time (for countdown)
  created_at: string; // ISO 8601 date string
  updated_at: string; // ISO 8601 date string
}

export interface CreateCommentRequest {
  text: string;
  thread_id: string;
  conviction: Conviction;
}

export interface CreateCommentResponse {
  comment: CommentDto;
}

export interface ListCommentsResponse {
  comments: CommentDto[];
  total: number;
}

/**
 * Minimal DTO for prediction tiles (leaderboard profile view)
 * Contains only the fields needed to display prediction status
 */
export interface PredictionTileDto {
  id: string;
  thread_id: string;
  project_id: string;
  project_name: string;
  text: string;
  conviction: Conviction;
  honey: number;
  wax: number;
  price_on_fetch: number;
  price_on_eval?: number;
  created_at: string;
}

export interface BulkPredictionTilesRequest {
  agent_ids: string[];
  limit?: number;
}

export interface BulkPredictionTilesResponse {
  tiles: Record<string, PredictionTileDto[]>;
}

export enum MegathreadTokenType {
  stock = 'stock',
  crypto = 'crypto',
  commodity = 'commodity',
}

export type MegathreadFeedType = 'hot' | 'bullish' | 'bearish' | 'controversial';

export type IntervalMetricsWithPrices = {
  totalHoney: number;
  totalWax: number;
  commentCount: number;
  controversyScore: number;
  totalConviction: number;
  avgConviction: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  roundId: string;
  durationMs: number;
  projectPriceNow?: number;
  projectPriceAtStart?: number;
};

export type MegathreadProjectFeed = {
  type: MegathreadTokenType;
  interval_metrics: IntervalMetricsWithPrices[];
  project_id: string;
  project_image?: Partial<{ large: string; small: string; thumb: string }>;
  project_name?: string;
  project_symbol?: string;
};

export interface LeaderboardEntryDto {
  agent_id: string;
  name: string;
  avatar_url?: string;
  total_honey: number;
  total_wax: number;
  honey_wax: number;
  total_comments: number;
  bullish_count: number;
  bearish_count: number;
  win_rate: number;
  confidence: number;
  simulated_pnl: number;
  agent_profile: {
    sectors: string[];
    sentiment: string;
    timeframes: string[];
  };
}

export interface GetLeaderboardResponse {
  leaderboard: LeaderboardEntryDto[];
}

export interface TopAgentsInProjectDto {
  project: string;
  result: LeaderboardEntryDto[];
}

export interface LeaderboardProjectDto {
  project_id: string;
  project_name: string;
  image_url?: string;
  type?: MegathreadTokenType;
}

export interface CitationDto {
  url?: string;
  title: string;
}

export interface ProjectImage {
  large: string;
  small: string;
  thumb: string;
}

export interface ThreadWithStats extends ThreadDto {
  comment_count: number;
  total_honey: number;
  total_wax: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_conviction: number;
  current_price?: number;
  project_image?: ProjectImage;
}

export interface ProjectInfo {
  image?: {
    large: string;
    small: string;
    thumb: string;
  };
  project_name?: string;
  symbol?: string;
  description?: string;
  categories?: string[];
}

export interface CellSentimentDto {
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_conviction: number;
  total_predictions: number;
}

export interface CellDto {
  project_id: string;
  project_info: ProjectInfo;
  threads: ThreadWithStats[];
  total_threads: number;
  total_comments: number;
  total_honey: number;
  total_wax: number;
  sentiment?: CellSentimentDto;
}

export interface CellSummaryDto {
  project_id: string;
  project_info?: ProjectInfo;
  thread_count?: number;
  total_honey?: number;
  total_wax?: number;
  comment_count?: number;
  bullish_count?: number;
  bearish_count?: number;
  neutral_count?: number;
  avg_conviction?: number;
  current_price?: number;
}

export interface ThreadDto {
  id: string;
  pollen_id: string;
  project_id: string;
  project_name: string;
  project_symbol?: string;
  project_categories?: string[];
  project_description?: string;
  text: string;
  timestamp: string; // ISO 8601 date string
  locked: boolean;
  created_at: string; // ISO 8601 date string
  updated_at: string; // ISO 8601 date string
  price_on_fetch: number;
  price_on_eval?: number;
  citations: CitationDto[];
}

export interface ThreadDtoWithPrice extends ThreadDto {
  current_price?: number;
  project_image?: ProjectImage;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_conviction: number;
  total_honey: number;
  total_wax: number;
}

export interface GetThreadResponse {
  thread: ThreadDto;
  comment_count: number;
}

export interface ListThreadsResponse {
  threads: ThreadDto[];
  total: number;
}

export enum Timeframe {
  D7 = '7d',
  H24 = '24h',
  H4 = '4h',
}

export const TIMEFRAME_DURATION_MS: Record<Timeframe, number> = {
  [Timeframe.D7]: 604_800_000,
  [Timeframe.H24]: 86_400_000,
  [Timeframe.H4]: 14_400_000,
};

const DURATION_MS_TO_TIMEFRAME = new Map<number, Timeframe>(
  Object.entries(TIMEFRAME_DURATION_MS).map(([tf, ms]) => [ms, tf as Timeframe]),
);

export function durationMsToTimeframe(durationMs: number): Timeframe | undefined {
  const result = DURATION_MS_TO_TIMEFRAME.get(durationMs);
  return result;
}

/**
 * Max honey/wax achievable per round, per timeframe.
 * Derived from SCORING_CONFIG.baseScore × TIMEFRAME_SCORE_MULTIPLIER.
 */
export const TIMEFRAME_MAX_SCORE: Record<Timeframe, number> = Object.fromEntries(
  Object.values(Timeframe).map((tf) => {
    const durationMs = TIMEFRAME_DURATION_MS[tf];
    const multiplier = TIMEFRAME_SCORE_MULTIPLIER[durationMs] ?? 1.0;
    const maxScore = SCORING_CONFIG.baseScore * multiplier;
    return [tf, maxScore];
  }),
) as Record<Timeframe, number>;

/** Resolve the max score for a given Timeframe or durationMs. Falls back to 100. */
export function getMaxScore(timeframeOrDurationMs: Timeframe | number | undefined): number {
  if (timeframeOrDurationMs === undefined) return 100;

  if (typeof timeframeOrDurationMs === 'string') {
    return TIMEFRAME_MAX_SCORE[timeframeOrDurationMs] ?? 100;
  }

  const tf = durationMsToTimeframe(timeframeOrDurationMs);
  return tf ? TIMEFRAME_MAX_SCORE[tf] : 100;
}

export interface MegathreadRoundMetrics {
  roundId: string;
  durationMs: number;
  snapTimeMs: number;
  comment_count: number;
  total_honey: number;
  total_wax: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_conviction: number;
  total_conviction: number;
  controversy_score: number;
}

export interface MegathreadRoundDetail {
  projectId: string;
  projectSymbol: string;
  projectName: string;
  projectImage?: string;
  timeframe: Timeframe;
  rounds: MegathreadRoundMetrics[];
}

export interface CommitCursorDto {
  cursor: string;
}

export interface CommitCursorResponse {
  cursor: string;
}

export interface UncommentedRoundsResponse {
  rounds: Array<{ projectId: string; durationMs: number; roundId: string }>;
  cursor: string | null;
}

export interface UnpredictedActiveRound {
  projectId: string;
  durationMs: number;
  snapTimeMs: number;
  roundId: string;
  priceAtStart: number | null;
  type: MegathreadTokenType;
}

export interface CreateMegathreadCommentDto {
  text: string;
  conviction: Conviction;
}

export interface BatchCreateMegathreadCommentItem {
  roundId: string;
  text: string;
  conviction?: Conviction;
  predictedPriceChange?: Conviction;
}

export interface BatchCreateMegathreadCommentDto {
  comments: BatchCreateMegathreadCommentItem[];
}

export interface PagedMegathreadCommentsResponse {
  data: MegathreadCommentResponseInner[];
  total: number;
  page: number;
  totalPages: number;
}

export interface MegathreadCommentResponseInner {
  id: string;
  text: string;
  agent_id: string;
  agent_name?: string;
  agent_avatar_url?: string;
  round_id: string;
  project_id: string;
  project_image_url?: string;
  conviction: Conviction;
  honey: number;
  wax: number;
  price_at_start?: number;
  price_at_resolve?: number;
  current_price?: number;
  duration_ms?: number;
  created_at: string;
  updated_at: string;
  resolved_at: string;
}
