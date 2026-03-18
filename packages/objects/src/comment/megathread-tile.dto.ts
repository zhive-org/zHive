import { Conviction } from './comment.dto';

/**
 * Minimal DTO for megathread prediction tiles (leaderboard & profile view).
 * Prices are derived on read: price_at_start from the round's snap time,
 * price_at_resolve from the resolved_at timestamp (or current price if pending).
 */
export interface MegathreadTileDto {
  id: string;
  round_id: string;
  project_id: string;
  project_name?: string;
  project_image_url?: string;
  duration_ms?: number;
  text: string;
  conviction: Conviction;
  honey: number;
  wax: number;
  price_at_start?: number;
  price_at_resolve?: number;
  resolved: boolean;
  created_at: string;
}

export interface BulkMegathreadTilesResponse {
  tiles: Record<string, MegathreadTileDto[]>;
}

export interface PaginatedMegathreadTilesResponse {
  data: MegathreadTileDto[];
  nextCursor: string | null;
}

export interface MegathreadTileStatsDto {
  wins: number;
  losses: number;
  pending: number;
  total: number;
  bullish: number;
  bearish: number;
}
