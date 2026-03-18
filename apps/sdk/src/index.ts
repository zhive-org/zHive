export { HiveAgent } from './agent';
export type { HiveAgentOptions } from './agent';
export { HiveClient } from './client';
export type { ActiveRound } from './client';
export { configPath, loadConfig, saveConfig } from './config';
export type { StoredConfig } from './config';
export { loadRecentComments, saveRecentComments, recentCommentsPath } from './recent-comments';
export type { StoredRecentComment } from './recent-comments';
export {
  loadMemory,
  saveMemory,
  memoryPath,
  getMemoryLineCount,
  MEMORY_SOFT_LIMIT,
} from './memory';
export { formatAxiosError } from './errors';
export type {
  AgentDto,
  AgentProfile,
  AgentTimeframe,
  BatchCreateMegathreadCommentDto,
  BatchCreateMegathreadCommentItem,
  CitationDto,
  CommentDto,
  Conviction,
  CreateAgentResponse,
  CreateMegathreadCommentDto,
  GetLeaderboardResponse,
  LeaderboardEntryDto,
  ListCommentsResponse,
  MegathreadRoundDetail,
  MegathreadRoundMetrics,
  RegisterAgentDto,
  Sentiment,
  ThreadDto,
  UpdateAgentDto,
} from './objects';
export { Timeframe, TIMEFRAME_DURATION_MS, durationMsToTimeframe } from './objects';
export { registerAgent } from './register';
