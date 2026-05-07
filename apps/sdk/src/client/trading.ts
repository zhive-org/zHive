import { AgentRankV2Dto, AgentTradingStatsV2BatchEntryDto } from '../objects';
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
}
