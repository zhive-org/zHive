import {
  MindshareDataPoint,
  MindshareDeltaSignalsResponse,
  MindshareFilterBy,
  MindshareRankBy,
  MindshareSMAZScoreSignalsResponse,
  MindshareTimeframe,
  ProjectMindshareDetail,
  ProjectMindshareLeaderboardItem,
  ProjectMindshareTimeseries,
  SectorMindshareDetail,
  SectorMindshareLeaderboardItem,
  SignalSortMode,
  UserMindshareDetail,
  UserMindshareLeaderboardItem,
} from '../objects';

export class MindshareClient {
  private readonly _baseUrl: string;

  public constructor(baseUrl: string) {
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
    return this._fetch<ProjectMindshareLeaderboardItem[]>('/mindshare/project/leaderboard', {
      timeframe,
      rankBy,
      limit,
    });
  }

  public async getProjectMindshare(
    projectId: string,
    timeframe?: MindshareTimeframe,
  ): Promise<ProjectMindshareDetail> {
    return this._fetch<ProjectMindshareDetail>(
      `/mindshare/project/${encodeURIComponent(projectId)}`,
      { timeframe },
    );
  }

  public async getProjectMindshareTimeseries(
    projectId: string,
    timeframe?: MindshareTimeframe,
  ): Promise<ProjectMindshareTimeseries> {
    return this._fetch<ProjectMindshareTimeseries>(
      `/mindshare/project/${encodeURIComponent(projectId)}/timeseries`,
      { timeframe },
    );
  }

  public async getProjectLeaderboardBySector(
    sectorId: string,
    timeframe?: MindshareTimeframe,
    rankBy?: MindshareRankBy,
    limit?: number,
    filterBy?: MindshareFilterBy,
  ): Promise<ProjectMindshareLeaderboardItem[]> {
    return this._fetch<ProjectMindshareLeaderboardItem[]>(
      `/mindshare/project/sector/${encodeURIComponent(sectorId)}/leaderboard`,
      { timeframe, rankBy, limit, filterBy },
    );
  }

  public async getSectorLeaderboard(
    timeframe?: MindshareTimeframe,
    rankBy?: MindshareRankBy,
    limit?: number,
  ): Promise<SectorMindshareLeaderboardItem[]> {
    return this._fetch<SectorMindshareLeaderboardItem[]>('/mindshare/sector/leaderboard', {
      timeframe,
      rankBy,
      limit,
    });
  }

  public async getSectorMindshare(
    sectorId: string,
    timeframe?: MindshareTimeframe,
  ): Promise<SectorMindshareDetail> {
    return this._fetch<SectorMindshareDetail>(`/mindshare/sector/${encodeURIComponent(sectorId)}`, {
      timeframe,
    });
  }

  public async getSectorMindshareTimeseries(
    sectorId: string,
    timeframe?: MindshareTimeframe,
  ): Promise<MindshareDataPoint[]> {
    return this._fetch<MindshareDataPoint[]>(
      `/mindshare/sector/${encodeURIComponent(sectorId)}/timeseries`,
      { timeframe },
    );
  }

  public async getUserLeaderboard(
    timeframe?: MindshareTimeframe,
    rankBy?: MindshareRankBy,
    limit?: number,
    page?: number,
  ): Promise<UserMindshareLeaderboardItem[]> {
    return this._fetch<UserMindshareLeaderboardItem[]>('/mindshare/user/leaderboard', {
      timeframe,
      rankBy,
      limit,
      page,
    });
  }

  public async getUserLeaderboardByProject(
    projectId: string,
    timeframe?: MindshareTimeframe,
    rankBy?: MindshareRankBy,
    limit?: number,
    page?: number,
  ): Promise<UserMindshareLeaderboardItem[]> {
    return this._fetch<UserMindshareLeaderboardItem[]>(
      `/mindshare/user/project/${encodeURIComponent(projectId)}/leaderboard`,
      { timeframe, rankBy, limit, page },
    );
  }

  public async getUserMindshare(
    userId: string,
    timeframe?: MindshareTimeframe,
    withTimeseries?: boolean,
  ): Promise<UserMindshareDetail> {
    return this._fetch<UserMindshareDetail>(`/mindshare/user/${encodeURIComponent(userId)}`, {
      timeframe,
      withTimeseries,
    });
  }

  public async getUserMindshareTimeseries(
    userId: string,
    timeframe?: MindshareTimeframe,
  ): Promise<MindshareDataPoint[]> {
    return this._fetch<MindshareDataPoint[]>(
      `/mindshare/user/${encodeURIComponent(userId)}/timeseries`,
      { timeframe },
    );
  }

  public async getMindshareDeltaSignals(
    projectId?: string,
    minThreshold?: number,
    limit?: number,
    page?: number,
    includeTrendingTopics?: boolean,
  ): Promise<MindshareDeltaSignalsResponse> {
    return this._fetch<MindshareDeltaSignalsResponse>('/signal/mindshare/delta', {
      projectId,
      minThreshold,
      limit,
      page,
      includeTrendingTopics,
    });
  }

  public async getMindshareMASignals(
    projectId?: string,
    minThreshold?: number,
    limit?: number,
    page?: number,
    includeTrendingTopics?: boolean,
  ): Promise<MindshareDeltaSignalsResponse> {
    return this._fetch<MindshareDeltaSignalsResponse>('/signal/mindshare/ma', {
      projectId,
      minThreshold,
      limit,
      page,
      includeTrendingTopics,
    });
  }

  public async getMindshareSMAZScoreSignals(
    projectId?: string,
    limit?: number,
    cursor?: string,
    mode?: SignalSortMode,
    includeSignalSummary?: boolean,
  ): Promise<MindshareSMAZScoreSignalsResponse> {
    return this._fetch<MindshareSMAZScoreSignalsResponse>('/signal/mindshare/sma-zscore', {
      projectId,
      limit,
      cursor,
      mode,
      includeSignalSummary,
    });
  }
}
