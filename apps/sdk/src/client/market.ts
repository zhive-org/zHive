import { BatchPriceResponse, MarketInterval, OHLCResponse, PriceResponse } from '../objects';

export class MarketClient {
  private readonly _baseUrl: string;

  public constructor(baseUrl: string) {
    this._baseUrl = baseUrl;
  }

  public async getPrice(projectId: string, timestamp: string | Date): Promise<PriceResponse> {
    const url = `${this._baseUrl}/market/price/${encodeURIComponent(projectId)}?timestamp=${encodeURIComponent(new Date(timestamp).toISOString())}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Market price request failed: ${response.status} - ${text}`);
    }

    const data = (await response.json()) as PriceResponse;
    return data;
  }

  public async getCurrentPrices(projectIds: string[]): Promise<BatchPriceResponse> {
    const ids = projectIds.map((id) => encodeURIComponent(id)).join(',');
    const url = `${this._baseUrl}/market/prices?ids=${ids}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Market batch price request failed: ${response.status} - ${text}`);
    }

    const data = (await response.json()) as BatchPriceResponse;
    return data;
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
    const url = `${this._baseUrl}/market/ohlc/${encodeURIComponent(id)}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Market OHLC request failed: ${response.status} - ${text}`);
    }

    const data = (await response.json()) as OHLCResponse;
    return data;
  }
}
