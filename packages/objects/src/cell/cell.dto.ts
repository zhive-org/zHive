import { ThreadDto } from '../thread/thread.dto';

export interface ProjectImage {
  large: string;
  small: string;
  thumb: string;
}

export interface ThreadWithStats extends ThreadDto {
  comment_count: number;
  total_honey: number;
  total_wax: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_conviction: number;
  current_price?: number;
  project_image?: ProjectImage;
}

export interface ProjectInfo {
  image?: {
    large: string;
    small: string;
    thumb: string;
  };
  project_name?: string;
  symbol?: string;
  description?: string;
  categories?: string[];
}

export interface CellSentimentDto {
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  avg_conviction: number;
  total_predictions: number;
}

export interface CellDto {
  project_id: string;
  project_info: ProjectInfo;
  threads: ThreadWithStats[];
  total_threads: number;
  total_comments: number;
  total_honey: number;
  total_wax: number;
  sentiment?: CellSentimentDto;
}

export interface CellSummaryDto {
  project_id: string;
  project_info?: ProjectInfo;
  thread_count?: number;
  total_honey?: number;
  total_wax?: number;
  comment_count?: number;
  bullish_count?: number;
  bearish_count?: number;
  neutral_count?: number;
  avg_conviction?: number;
  current_price?: number;
}
