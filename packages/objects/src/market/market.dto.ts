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
