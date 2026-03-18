import { HIVE_API_URL } from '../../../config/constant.js';

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

export class MindshareClient {
  private readonly _baseUrl: string;

  public constructor(baseUrl: string = HIVE_API_URL) {
    this._baseUrl = baseUrl;
  }

  private async _fetch<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = new URL(path, this._baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mindshare API request failed: ${response.status} - ${text}`);
    }

    const data = (await response.json()) as T;
    return data;
  }

  public async getProjectLeaderboard(
    timeframe?: MindshareTimeframe,
    rankBy?: MindshareRankBy,
    limit?: number,
  ): Promise<ProjectMindshareLeaderboardItem[]> {
    const result = await this._fetch<ProjectMindshareLeaderboardItem[]>(
      '/mindshare/project/leaderboard',
      {
        timeframe,
        rankBy,
        limit,
      },
    );
    return result;
  }

  public async getProjectMindshare(
    projectId: string,
    timeframe?: MindshareTimeframe,
  ): Promise<ProjectMindshareDetail> {
    const result = await this._fetch<ProjectMindshareDetail>(
      `/mindshare/project/${encodeURIComponent(projectId)}`,
      {
        timeframe,
      },
    );
    return result;
  }

  public async getProjectMindshareTimeseries(
    projectId: string,
    timeframe?: MindshareTimeframe,
  ): Promise<ProjectMindshareTimeseries> {
    const result = await this._fetch<ProjectMindshareTimeseries>(
      `/mindshare/project/${encodeURIComponent(projectId)}/timeseries`,
      { timeframe },
    );
    return result;
  }

  public async getProjectLeaderboardBySector(
    sectorId: string,
    timeframe?: MindshareTimeframe,
    rankBy?: MindshareRankBy,
    limit?: number,
    filterBy?: MindshareFilterBy,
  ): Promise<ProjectMindshareLeaderboardItem[]> {
    const result = await this._fetch<ProjectMindshareLeaderboardItem[]>(
      `/mindshare/project/sector/${encodeURIComponent(sectorId)}/leaderboard`,
      { timeframe, rankBy, limit, filterBy },
    );
    return result;
  }

  public async getSectorLeaderboard(
    timeframe?: MindshareTimeframe,
    rankBy?: MindshareRankBy,
    limit?: number,
  ): Promise<SectorMindshareLeaderboardItem[]> {
    const result = await this._fetch<SectorMindshareLeaderboardItem[]>(
      '/mindshare/sector/leaderboard',
      {
        timeframe,
        rankBy,
        limit,
      },
    );
    return result;
  }

  public async getSectorMindshare(
    sectorId: string,
    timeframe?: MindshareTimeframe,
  ): Promise<SectorMindshareDetail> {
    const result = await this._fetch<SectorMindshareDetail>(
      `/mindshare/sector/${encodeURIComponent(sectorId)}`,
      {
        timeframe,
      },
    );
    return result;
  }

  public async getSectorMindshareTimeseries(
    sectorId: string,
    timeframe?: MindshareTimeframe,
  ): Promise<MindshareDataPoint[]> {
    const result = await this._fetch<MindshareDataPoint[]>(
      `/mindshare/sector/${encodeURIComponent(sectorId)}/timeseries`,
      { timeframe },
    );
    return result;
  }

  public async getUserLeaderboard(
    timeframe?: MindshareTimeframe,
    rankBy?: MindshareRankBy,
    limit?: number,
    page?: number,
  ): Promise<UserMindshareLeaderboardItem[]> {
    const result = await this._fetch<UserMindshareLeaderboardItem[]>(
      '/mindshare/user/leaderboard',
      {
        timeframe,
        rankBy,
        limit,
        page,
      },
    );
    return result;
  }

  public async getUserLeaderboardByProject(
    projectId: string,
    timeframe?: MindshareTimeframe,
    rankBy?: MindshareRankBy,
    limit?: number,
    page?: number,
  ): Promise<UserMindshareLeaderboardItem[]> {
    const result = await this._fetch<UserMindshareLeaderboardItem[]>(
      `/mindshare/user/project/${encodeURIComponent(projectId)}/leaderboard`,
      { timeframe, rankBy, limit, page },
    );
    return result;
  }

  public async getUserMindshare(
    userId: string,
    timeframe?: MindshareTimeframe,
    withTimeseries?: boolean,
  ): Promise<UserMindshareDetail> {
    const result = await this._fetch<UserMindshareDetail>(
      `/mindshare/user/${encodeURIComponent(userId)}`,
      {
        timeframe,
        withTimeseries,
      },
    );
    return result;
  }

  public async getUserMindshareTimeseries(
    userId: string,
    timeframe?: MindshareTimeframe,
  ): Promise<MindshareDataPoint[]> {
    const result = await this._fetch<MindshareDataPoint[]>(
      `/mindshare/user/${encodeURIComponent(userId)}/timeseries`,
      { timeframe },
    );
    return result;
  }

  public async getMindshareDeltaSignals(
    projectId?: string,
    minThreshold?: number,
    limit?: number,
    page?: number,
    includeTrendingTopics?: boolean,
  ): Promise<MindshareDeltaSignalsResponse> {
    const result = await this._fetch<MindshareDeltaSignalsResponse>('/signal/mindshare/delta', {
      projectId,
      minThreshold,
      limit,
      page,
      includeTrendingTopics,
    });
    return result;
  }

  public async getMindshareMASignals(
    projectId?: string,
    minThreshold?: number,
    limit?: number,
    page?: number,
    includeTrendingTopics?: boolean,
  ): Promise<MindshareDeltaSignalsResponse> {
    const result = await this._fetch<MindshareDeltaSignalsResponse>('/signal/mindshare/ma', {
      projectId,
      minThreshold,
      limit,
      page,
      includeTrendingTopics,
    });
    return result;
  }

  public async getMindshareSMAZScoreSignals(
    projectId?: string,
    limit?: number,
    cursor?: string,
    mode?: SignalSortMode,
    includeSignalSummary?: boolean,
  ): Promise<MindshareSMAZScoreSignalsResponse> {
    const result = await this._fetch<MindshareSMAZScoreSignalsResponse>(
      '/signal/mindshare/sma-zscore',
      {
        projectId,
        limit,
        cursor,
        mode,
        includeSignalSummary,
      },
    );
    return result;
  }
}

let clientInstance: MindshareClient | null = null;

export function getMindshareClient(): MindshareClient {
  if (clientInstance === null) {
    clientInstance = new MindshareClient();
  }
  return clientInstance;
}
