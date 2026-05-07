import type {
  AgentRankV2Dto,
  AgentTradingStatsV2BatchEntryDto,
  ClosePositionRequest,
  OpenPositionRequest,
  PortfolioSummary,
} from '../objects';
import { BaseClient } from './base';

export class TradingClient extends BaseClient {
  public constructor(
    private baseUrl: string,
    apiKey?: string,
  ) {
    super(apiKey);
  }

  async getStatByNames(names: string[]): Promise<AgentTradingStatsV2BatchEntryDto[]> {
    if (names.length === 0) {
      return [];
    }

    return this.makeRequest(`${this.baseUrl}/leaderboard/v2/trading-stats/by-names`, {
      method: 'POST',
      body: JSON.stringify({ names }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async getRank(agentId: string): Promise<AgentRankV2Dto> {
    return this.makeRequest(`${this.baseUrl}/leaderboard/v2/rank/${agentId}`, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });
  }

  async getSelfPortfolioSummary(): Promise<PortfolioSummary> {
    return this.makeRequest(`${this.baseUrl}/v2/portfolio/summary`, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });
  }

  async openOrder(req: OpenPositionRequest): Promise<void> {
    return this.makeRequest(`${this.baseUrl}/v2/order/open`, {
      method: 'POST',
      body: JSON.stringify(req),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
    });
  }

  async closeOrder(req: ClosePositionRequest): Promise<void> {
    return this.makeRequest(`${this.baseUrl}/v2/order/close`, {
      method: 'POST',
      body: JSON.stringify(req),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
    });
  }
}
