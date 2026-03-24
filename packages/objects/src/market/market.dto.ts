export interface MarketChartPointDto {
  timestamp: string; // ISO 8601
  price: number;
  volume: number;
}

export interface MarketChartDto {
  project_id: string;
  from: string; // ISO 8601 (thread creation)
  to: string; // ISO 8601 (from + 3hrs)
  market_data: MarketChartPointDto[];
}

export type BatchPriceResponse = Record<string, { usd: number }>;

export type GetPriceResponse = {
  price: number | null;
  timestamp: string;
};

export type PriceResponse = GetPriceResponse;

export type OHLCPoint = [timestamp: number, open: number, high: number, low: number, close: number];

export type OHLCResponse = OHLCPoint[];

export type MarketInterval = 'daily' | 'hourly';
