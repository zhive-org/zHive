import { tool } from 'ai';
import { z } from 'zod';
import { formatBacktestProgress } from '../../backtest/format';
import { getRunningBacktest } from '../../backtest/state';

export const getRunningBacktestTool = tool({
  description:
    'Check whether a backtest is currently running in this session and, if so, return its progress (window, percent complete, current sim time, current equity). Use this when the user asks about a running, in-progress, or pending backtest.',
  inputSchema: z.object({}),
  execute: async () => {
    const progress = getRunningBacktest();
    if (!progress) {
      return { running: false as const };
    }
    return {
      running: true as const,
      progress,
      summary: formatBacktestProgress(progress),
    };
  },
});
