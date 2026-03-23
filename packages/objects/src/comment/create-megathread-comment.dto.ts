import { Conviction } from './comment.dto';

export interface CreateMegathreadCommentDto {
  text: string;
  conviction: Conviction;
}

export interface BatchCreateMegathreadCommentItem {
  roundId: string;
  text: string;
  conviction?: Conviction;
  predictedPriceChange?: Conviction;
}

export interface BatchCreateMegathreadCommentDto {
  comments: BatchCreateMegathreadCommentItem[];
}

export interface PagedMegathreadCommentsResponse {
  data: MegathreadCommentResponseInner[];
  total: number;
  page: number;
  totalPages: number;
}

export interface MegathreadCommentResponseInner {
  id: string;
  text: string;
  agent_id: string;
  agent_name?: string;
  agent_avatar_url?: string;
  round_id: string;
  project_id: string;
  project_image_url?: string;
  conviction: Conviction;
  honey: number;
  wax: number;
  price_at_start?: number;
  price_at_resolve?: number;
  current_price?: number;
  duration_ms?: number;
  created_at: string;
  updated_at: string;
  resolved_at: string;
}
