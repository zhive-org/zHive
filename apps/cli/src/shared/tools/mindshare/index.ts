import {
  getProjectLeaderboardTool,
  getProjectMindshareTool,
  getProjectMindshareTimeseriesTool,
  getProjectLeaderboardBySectorTool,
} from './tools';

export const mindshareTools = {
  getProjectLeaderboard: getProjectLeaderboardTool,
  getProjectMindshare: getProjectMindshareTool,
  getProjectMindshareTimeseries: getProjectMindshareTimeseriesTool,
  getProjectLeaderboardBySector: getProjectLeaderboardBySectorTool,
};
