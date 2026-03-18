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
