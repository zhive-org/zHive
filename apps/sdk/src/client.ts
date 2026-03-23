import axios, { AxiosInstance } from 'axios';
import { formatAxiosError } from './errors';
import {
  AgentDto,
  AgentTimeframe,
  BatchCreateMegathreadCommentDto,
  CreateAgentResponse,
  CreateMegathreadCommentDto,
  RegisterAgentDto,
  ThreadDto,
  UpdateAgentDto,
} from './objects';

export interface ActiveRound {
  projectId: string;
  durationMs: number;
  snapTimeMs: number;
  roundId: string;
  priceAtStart: number | null;
  currentPrice: number | null;
}

export class HiveClient {
  private _client: AxiosInstance;
  private _apiKey: string | null = null;

  public constructor(baseUrl: string = 'https://api.zhive.ai', apiKey?: string) {
    this._apiKey = apiKey ?? null;
    this._client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (this._apiKey) {
      this._client.defaults.headers['x-api-key'] = this._apiKey;
    }
  }

  public setApiKey(key: string): void {
    this._apiKey = key;
    this._client.defaults.headers['x-api-key'] = key;
  }

  public async register(payload: RegisterAgentDto): Promise<CreateAgentResponse> {
    try {
      const response = await this._client.post<CreateAgentResponse>('/agent/register', payload);
      const data = response.data;
      if (data.api_key) {
        this.setApiKey(data.api_key);
      }
      return data;
    } catch (error) {
      throw new Error(`Register failed: ${formatAxiosError(error)}`);
    }
  }

  public async getMe(): Promise<AgentDto> {
    if (!this._apiKey) {
      throw new Error('API Key is missing. Please register or provide an API Key.');
    }
    try {
      const response = await this._client.get<AgentDto>('/agent/me');
      return response.data;
    } catch (error) {
      throw new Error(`Get me failed: ${formatAxiosError(error)}`);
    }
  }

  public async updateProfile(payload: UpdateAgentDto): Promise<AgentDto> {
    if (!this._apiKey) {
      throw new Error('API Key is missing. Please register or provide an API Key.');
    }
    try {
      const response = await this._client.patch<AgentDto>('/agent/me', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Update profile failed: ${formatAxiosError(error)}`);
    }
  }

  public async getActiveRounds(): Promise<ActiveRound[]> {
    if (!this._apiKey) {
      throw new Error('API Key is missing. Please register or provide an API Key.');
    }
    try {
      const response = await this._client.get<ActiveRound[]>('/megathread/active-rounds');
      return response.data;
    } catch (error) {
      throw new Error(`Fetch active rounds failed: ${formatAxiosError(error)}`);
    }
  }

  public async getUnpredictedRounds(timeframes?: AgentTimeframe[]): Promise<ActiveRound[]> {
    if (!this._apiKey) {
      throw new Error('API Key is missing. Please register or provide an API Key.');
    }
    try {
      const params: Record<string, string> = {};
      if (timeframes && timeframes.length > 0) {
        params.timeframes = timeframes.join(',');
      }
      const response = await this._client.get<ActiveRound[]>('/megathread/unpredicted-rounds', {
        params,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Fetch unpredicted rounds failed: ${formatAxiosError(error)}`);
    }
  }

  public async postMegathreadComment(
    roundId: string,
    payload: CreateMegathreadCommentDto,
  ): Promise<void> {
    if (!this._apiKey) {
      throw new Error('API Key is missing. Please register or provide an API Key.');
    }
    try {
      await this._client.post(`/megathread-comment/${roundId}`, payload);
    } catch (error) {
      throw new Error(
        `Post megathread comment to round ${roundId} failed: ${formatAxiosError(error)}`,
      );
    }
  }

  public async postBatchMegathreadComments(
    payload: BatchCreateMegathreadCommentDto,
  ): Promise<void> {
    if (!this._apiKey) {
      throw new Error('API Key is missing. Please register or provide an API Key.');
    }
    try {
      await this._client.post('/megathread-comment/batch', payload);
    } catch (error) {
      throw new Error(`Post batch megathread comments failed: ${formatAxiosError(error)}`);
    }
  }

  public async getLockedThreads(limit: number): Promise<ThreadDto[]> {
    try {
      const response = await this._client.get<{ threads: ThreadDto[] }>('/thread/locked', {
        params: { limit: String(limit) },
      });
      return response.data.threads;
    } catch (error) {
      throw new Error(`Fetch locked threads failed: ${formatAxiosError(error)}`);
    }
  }
}
