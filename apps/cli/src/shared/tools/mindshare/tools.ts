import { tool } from 'ai';
import { z } from 'zod';
import {
  formatPeriodChange,
  formatToolError,
  signPrefix,
  truncateTimeseries,
  truncationLabel,
} from '../../agent/utils';
import type {
  MindshareData,
  MindshareFilterBy,
  MindshareRankBy,
  MindshareTimeframe,
} from '@zhive/sdk';
import { getHiveClient } from '../../config/hive-client';

const timeframeSchema = z
  .enum(['30m', '24h', '3D', '7D', '1M', '3M', 'YTD'])
  .optional()
  .describe('Timeframe for mindshare data. Defaults to 24h.');

const rankBySchema = z
  .enum(['delta', 'value'])
  .optional()
  .describe('Rank by "delta" (change) or "value" (absolute). Defaults to value.');

const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .describe('Number of results to return (max 100). Defaults to 20.');

function formatMindshare(ms: MindshareData | undefined): {
  value: string;
  delta: string;
  rank: string;
} {
  const value = ms?.value != null ? `${(ms.value * 100).toFixed(4)}%` : 'N/A';
  const rawDelta = ms?.delta ?? 0;
  const delta = `${signPrefix(rawDelta)}${(rawDelta * 100).toFixed(2)}%`;
  const rank = ms?.rank != null ? `#${ms.rank}` : 'N/A';
  return { value, delta, rank };
}

export const getProjectLeaderboardTool = tool({
  description:
    'Get the top trending projects by mindshare. Returns a ranked list of projects sorted by mindshare value or delta change. Use this to identify what projects are gaining attention.',
  inputSchema: z.object({
    timeframe: timeframeSchema,
    rankBy: rankBySchema,
    limit: limitSchema,
  }),
  execute: async ({ timeframe, rankBy, limit }) => {
    try {
      const client = getHiveClient().mindshare;
      const data = await client.getProjectLeaderboard(
        timeframe as MindshareTimeframe | undefined,
        rankBy as MindshareRankBy | undefined,
        limit,
      );

      if (data.length === 0) {
        return 'No projects found in the mindshare leaderboard.';
      }

      const lines: string[] = [
        `Top ${data.length} Projects by Mindshare (${timeframe ?? '24h'}, ranked by ${rankBy ?? 'value'}):`,
        '',
        'Rank | Project | Mindshare | Delta',
        '--- | --- | --- | ---',
      ];

      for (const item of data) {
        const ms = formatMindshare(item.mindshare);
        lines.push(`${ms.rank} | ${item.name} | ${ms.value} | ${ms.delta}`);
      }

      const output = lines.join('\n');
      return output;
    } catch (err) {
      return formatToolError(err, 'fetching project leaderboard');
    }
  },
});

export const getProjectMindshareTool = tool({
  description:
    'Get the mindshare data for a specific project by ID. Returns current mindshare value, delta change, and ranking position.',
  inputSchema: z.object({
    projectId: z.string().describe('The project ID to look up.'),
    timeframe: timeframeSchema,
  }),
  execute: async ({ projectId, timeframe }) => {
    try {
      const client = getHiveClient().mindshare;
      const data = await client.getProjectMindshare(
        projectId,
        timeframe as MindshareTimeframe | undefined,
      );

      const ms = formatMindshare(data.mindshare);

      const lines: string[] = [
        `Mindshare for ${data.name ?? projectId} (${timeframe ?? '24h'}):`,
        '',
        `- Rank: ${ms.rank}`,
        `- Mindshare Value: ${ms.value}`,
        `- Delta Change: ${ms.delta}`,
      ];

      if (data.symbol) {
        lines.push(`- Symbol: ${data.symbol}`);
      }

      const output = lines.join('\n');
      return output;
    } catch (err) {
      return formatToolError(err, 'fetching project mindshare');
    }
  },
});

export const getProjectMindshareTimeseriesTool = tool({
  description:
    'Get historical mindshare data for a specific project. Returns timeseries data points showing mindshare value over time.',
  inputSchema: z.object({
    projectId: z.string().describe('The project ID to look up.'),
    timeframe: timeframeSchema,
  }),
  execute: async ({ projectId, timeframe }) => {
    try {
      const client = getHiveClient().mindshare;
      const data = await client.getProjectMindshareTimeseries(
        projectId,
        timeframe as MindshareTimeframe | undefined,
      );

      if (!data.data_points || data.data_points.length === 0) {
        return `No historical mindshare data available for project ${projectId}.`;
      }

      const points = data.data_points;
      const lines: string[] = [
        `Mindshare Timeseries for ${projectId} (${timeframe ?? '24h'}, ${points.length} data points):`,
        '',
      ];

      const displayPoints = truncateTimeseries(points);

      for (const point of displayPoints) {
        if (point === null) {
          lines.push(truncationLabel(points.length, 15));
          continue;
        }
        const date = new Date(point.timestamp).toISOString();
        lines.push(`${date}: ${(point.value * 100).toFixed(4)}%`);
      }

      lines.push('');
      lines.push(formatPeriodChange(points[0].value, points[points.length - 1].value));

      const output = lines.join('\n');
      return output;
    } catch (err) {
      return formatToolError(err, 'fetching project mindshare timeseries');
    }
  },
});

export const getProjectLeaderboardBySectorTool = tool({
  description:
    'Get the top projects within a specific sector by mindshare. Use this to analyze which projects are gaining attention in a particular market segment.',
  inputSchema: z.object({
    sectorId: z.string().describe('The sector ID to filter by.'),
    timeframe: timeframeSchema,
    rankBy: rankBySchema,
    limit: limitSchema,
    filterBy: z
      .enum(['all', 'preTGE', 'nonePreTGE'])
      .optional()
      .describe('Filter by project stage: all, preTGE (pre-token launch), or nonePreTGE.'),
  }),
  execute: async ({ sectorId, timeframe, rankBy, limit, filterBy }) => {
    try {
      const client = getHiveClient().mindshare;
      const data = await client.getProjectLeaderboardBySector(
        sectorId,
        timeframe as MindshareTimeframe | undefined,
        rankBy as MindshareRankBy | undefined,
        limit,
        filterBy as MindshareFilterBy | undefined,
      );

      if (data.length === 0) {
        return `No projects found in sector ${sectorId}.`;
      }

      const lines: string[] = [
        `Top ${data.length} Projects in Sector "${sectorId}" (${timeframe ?? '24h'}, ranked by ${rankBy ?? 'value'}):`,
        '',
        'Rank | Project | Mindshare | Delta',
        '--- | --- | --- | ---',
      ];

      for (const item of data) {
        const ms = formatMindshare(item.mindshare);
        lines.push(`${ms.rank} | ${item.name} | ${ms.value} | ${ms.delta}`);
      }

      const output = lines.join('\n');
      return output;
    } catch (err) {
      return formatToolError(err, 'fetching sector project leaderboard');
    }
  },
});
