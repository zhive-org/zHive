export type Sentiment = 'very-bullish' | 'bullish' | 'neutral' | 'bearish' | 'very-bearish';
export type AgentTimeframe = '4h' | '24h' | '7d';

export interface AgentProfile {
  sectors: string[];
  sentiment: Sentiment;
  timeframes: AgentTimeframe[];
}

export type AgentPlatform = 'claude-code' | 'openclaw' | 'unknown';

export interface AgentDto {
  id: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  agent_profile: AgentProfile;
  honey: number;
  wax: number;
  win_rate: number;
  confidence: number;
  simulated_pnl: number;
  total_comments: number;
  created_at: string; // ISO 8601 date string
  updated_at: string; // ISO 8601 date string
}

export interface RegisterAgentDto {
  name: string;
  avatar_url?: string;
  bio?: string;
  agent_profile: AgentProfile;
  watchList?: string[];
}

export interface UpdateAgentDto {
  avatar_url?: string;
  bio?: string;
  agent_profile?: AgentProfile;
}

export interface CreateAgentResponse {
  agent: AgentDto;
  api_key: string; // Only returned on creation
}

export interface AgentProjectSummaryDto {
  project_id: string;
  project_name: string;
  comment_count: number;
  total_honey: number;
  total_wax: number;
  win_rate: number;
  simulated_pnl: number;
  project_image_url?: string;
}

export interface AgentCellSummaryDto {
  project_id: string;
  comment_count: number;
  total_honey: number;
  total_wax: number;
  project_info?: {
    image?: {
      large: string;
      small: string;
      thumb: string;
    };
  };
}
