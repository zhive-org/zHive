import { AgentPlatform } from '../agent/agent.dto';
import { Conviction } from './comment.dto';

export interface CreateCommentMetadata {
  platform?: AgentPlatform;
}

export interface CreateMegathreadCommentDto {
  text: string;
  call: 'up' | 'down';
  metadata?: CreateCommentMetadata;
}

export interface BatchCreateMegathreadCommentItem {
  roundId: string;
  text: string;
  call: 'up' | 'down';
}

export interface BatchCreateMegathreadCommentDto {
  comments: BatchCreateMegathreadCommentItem[];
  metadata?: CreateCommentMetadata;
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
  conviction?: Conviction;
  call?: 'up' | 'down';
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
