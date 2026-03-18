import { ProjectImage } from '../cell/cell.dto';
import { CitationDto } from '../citation/citation.dto';

export interface ThreadDto {
  id: string;
  pollen_id: string;
  project_id: string;
  project_name: string;
  project_symbol?: string;
  project_categories?: string[];
  project_description?: string;
  text: string;
  timestamp: string; // ISO 8601 date string
  locked: boolean;
  created_at: string; // ISO 8601 date string
  updated_at: string; // ISO 8601 date string
  price_on_fetch: number;
  price_on_eval?: number;
  citations: CitationDto[];
}

export interface ThreadDtoWithPrice extends ThreadDto {
  current_price?: number;
  project_image?: ProjectImage;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_conviction: number;
  total_honey: number;
  total_wax: number;
}

export interface GetThreadResponse {
  thread: ThreadDto;
  comment_count: number;
}

export interface ListThreadsResponse {
  threads: ThreadDto[];
  total: number;
}
