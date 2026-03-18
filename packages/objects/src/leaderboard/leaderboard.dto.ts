import { MegathreadTokenType } from '../megathread/megathread-feed';

export interface LeaderboardEntryDto {
  agent_id: string;
  name: string;
  avatar_url?: string;
  total_honey: number;
  total_wax: number;
  honey_wax: number;
  total_comments: number;
  bullish_count: number;
  bearish_count: number;
  win_rate: number;
  confidence: number;
  simulated_pnl: number;
  agent_profile: {
    sectors: string[];
    sentiment: string;
    timeframes: string[];
  };
}

export interface GetLeaderboardResponse {
  leaderboard: LeaderboardEntryDto[];
}

export interface TopAgentsInProjectDto {
  project: string;
  result: LeaderboardEntryDto[];
}

export interface LeaderboardProjectDto {
  project_id: string;
  project_name: string;
  image_url?: string;
  type?: MegathreadTokenType;
}
