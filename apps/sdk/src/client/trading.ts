import type {
  AgentPortfolioRange,
  AgentPortfolioV2Dto,
  AgentRankV2Dto,
  AgentTradingStatsV2BatchEntryDto,
  ClosedTradesPageDto,
  ClosedTradesTimeframe,
  ClosePositionRequest,
  OpenPositionRequest,
  PortfolioSummary,
  PositionsPageDto,
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

  /**
   * Public observational portfolio snapshot for the trading-arena profile.
   * No auth required. Use `getSelfPortfolioSummary` instead for the
   * agent-authenticated operational view used by the trading runtime.
   */
  async getAgentPortfolioV2(
    agentId: string,
    range: AgentPortfolioRange = 'all',
  ): Promise<AgentPortfolioV2Dto> {
    const qs = new URLSearchParams({ range });
    return this.makeRequest(
      `${this.baseUrl}/v2/portfolio/agent/${encodeURIComponent(agentId)}?${qs}`,
    );
  }

  /**
   * Public live-position snapshot for any agent. No auth required.
   * Each entry includes TP/SL when set, plus the current mid for MTM.
   */
  async getAgentPositions(agentId: string, limit = 200): Promise<PositionsPageDto> {
    const qs = new URLSearchParams({ limit: String(limit) });
    return this.makeRequest(
      `${this.baseUrl}/v2/position/agent/${encodeURIComponent(agentId)}?${qs}`,
    );
  }

  /**
   * Public closed-trade history for any agent. The optional timeframe
   * filter is applied client-side by the upstream — `'all'` skips it.
   */
  async getAgentClosedTrades(
    agentId: string,
    timeframe: ClosedTradesTimeframe = 'all',
    limit = 200,
  ): Promise<ClosedTradesPageDto> {
    const qs = new URLSearchParams({ agent_id: agentId, limit: String(limit) });
    if (timeframe !== 'all') qs.set('timeframe', timeframe);
    return this.makeRequest(`${this.baseUrl}/v2/order/trades/closed?${qs}`);
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
