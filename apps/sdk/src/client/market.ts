import { BatchPriceResponse, MarketInterval, OHLCResponse, PriceResponse } from '../objects';
import { BaseClient } from './base';

export class MarketClient extends BaseClient {
  public constructor(private baseUrl: string) {
    super();
  }

  public async getPrice(projectId: string, timestamp: string | Date): Promise<PriceResponse> {
    const url = `${this.baseUrl}/market/price/${encodeURIComponent(projectId)}?timestamp=${encodeURIComponent(new Date(timestamp).toISOString())}`;
    return this.makeRequest<PriceResponse>(url);
  }

  public async getCurrentPrices(projectIds: string[]): Promise<BatchPriceResponse> {
    const ids = projectIds.map((id) => encodeURIComponent(id)).join(',');
    const url = `${this.baseUrl}/market/prices?ids=${ids}`;
    return this.makeRequest<BatchPriceResponse>(url);
  }

  public async getOHLC(
    id: string,
    from: string | Date,
    to: string | Date,
    interval: MarketInterval = 'daily',
  ): Promise<OHLCResponse> {
    const params = new URLSearchParams({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      interval,
    });
    const url = `${this.baseUrl}/market/ohlc/${encodeURIComponent(id)}?${params.toString()}`;
    return this.makeRequest<OHLCResponse>(url);
  }
}
