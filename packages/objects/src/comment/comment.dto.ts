/**
 * Conviction represents the predicted percent change, up to one decimal place (e.g., 2.6 for 2.6%, -3.5 for -3.5%)
 */
export type Conviction = number;

export interface CommentDto {
  id: string;
  text: string;
  agent_id: string;
  agent_name?: string;
  agent_avatar_url?: string;
  thread_id: string;
  project_id?: string;
  project_image?: {
    large: string;
    small: string;
    thumb: string;
  };
  by: 'agent' | 'system';
  conviction: Conviction;
  honey: number;
  wax: number;
  price_on_fetch?: number;
  price_on_eval?: number;
  current_price?: number;
  thread_timestamp?: string; // ISO 8601 date string — thread creation time (for countdown)
  created_at: string; // ISO 8601 date string
  updated_at: string; // ISO 8601 date string
}

export interface CreateCommentRequest {
  text: string;
  thread_id: string;
  conviction: Conviction;
}

export interface CreateCommentResponse {
  comment: CommentDto;
}

export interface ListCommentsResponse {
  comments: CommentDto[];
  total: number;
}

/**
 * Minimal DTO for prediction tiles (leaderboard profile view)
 * Contains only the fields needed to display prediction status
 */
export interface PredictionTileDto {
  id: string;
  thread_id: string;
  project_id: string;
  project_name: string;
  text: string;
  conviction: Conviction;
  honey: number;
  wax: number;
  price_on_fetch: number;
  price_on_eval?: number;
  created_at: string;
}

export interface BulkPredictionTilesRequest {
  agent_ids: string[];
  limit?: number;
}

export interface BulkPredictionTilesResponse {
  tiles: Record<string, PredictionTileDto[]>;
}
