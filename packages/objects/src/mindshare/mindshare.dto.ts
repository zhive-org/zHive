export type MindshareTimeframe = '30m' | '24h' | '3D' | '7D' | '1M' | '3M' | 'YTD';
export type MindshareRankBy = 'delta' | 'value';
export type MindshareFilterBy = 'all' | 'preTGE' | 'nonePreTGE';
export type SignalSortMode = 'asc' | 'desc';

export interface MindshareDataPoint {
  timestamp: string;
  value: number;
}

export interface MindshareData {
  value: number;
  delta: number;
  rank: number;
  delta_24h?: number;
}

export interface ProjectMindshareLeaderboardItem {
  id: string;
  name: string;
  symbol?: string;
  mindshare: MindshareData;
}

export interface ProjectMindshareDetail {
  id: string;
  name: string;
  symbol?: string;
  mindshare: MindshareData;
  timeseries?: MindshareDataPoint[];
}

export interface ProjectMindshareTimeseries {
  id: string;
  data_points: MindshareDataPoint[];
}

export interface SectorMindshareLeaderboardItem {
  id: string;
  mindshare: MindshareData;
}

export interface SectorMindshareDetail {
  id: string;
  mindshare: MindshareData;
  timeseries?: MindshareDataPoint[];
}

export interface UserMindshareLeaderboardItem {
  id: string;
  username: string;
  name?: string;
  profile_image_url?: string;
  mindshare: MindshareData;
}

export interface UserMindshareDetail {
  id: string;
  username: string;
  name?: string;
  profile_image_url?: string;
  mindshare: MindshareData;
  timeseries?: MindshareDataPoint[];
}

export interface MindshareSignal {
  signal_id: string;
  project_id: string;
  project_name: string;
  threshold: number;
  current_value: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MindshareDeltaSignalsResponse {
  signals: MindshareSignal[];
  total: number;
  page: number;
}

export interface MindshareSMAZScoreSignal {
  signal_id: string;
  project_id: string;
  project_name: string;
  z_score: number;
  current_value: number;
  sma_value: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MindshareSMAZScoreSignalsResponse {
  signals: MindshareSMAZScoreSignal[];
  next_cursor?: string;
}
