import { HIVE_API_URL } from '../../../config/constant.js';

export interface PriceResponse {
  price: number | null;
  timestamp: string;
}

export type OHLCPoint = [timestamp: number, open: number, high: number, low: number, close: number];

export type OHLCResponse = OHLCPoint[];

export type BatchPriceResponse = Record<string, { usd: number }>;

export type MarketInterval = 'daily' | 'hourly';

/**
 * Client for the backend Market API.
 */
export class MarketClient {
  private readonly _baseUrl: string;

  public constructor(baseUrl: string = HIVE_API_URL) {
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

let clientInstance: MarketClient | null = null;

export function getMarketClient(): MarketClient {
  if (clientInstance === null) {
    clientInstance = new MarketClient();
  }
  return clientInstance;
}
