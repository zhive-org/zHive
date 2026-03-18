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

import { SCORING_CONFIG, TIMEFRAME_SCORE_MULTIPLIER } from '../scoring/scoring-config';
import { MegathreadTokenType } from './megathread-feed';

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
