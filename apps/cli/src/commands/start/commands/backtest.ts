import { HIVE_API_URL } from '../../../shared/config/constant.js';
import { fetchBacktestThreads } from '../services/backtest/fetch.js';
import { buildTextReport } from '../services/backtest/results.js';
import { runBacktest, RunnerCallbacks, RunnerConfig } from '../services/backtest/runner.js';
import { loadDefaultBacktest } from '../services/backtest/storage.js';
import { BacktestData } from '../services/backtest/types.js';

export const backtestSlashCommand = async (
  args: string[],
  config: RunnerConfig,
  callbacks: {
    onFetchStart?: (numThreads: number) => void;
    onFetchError?: (error: string) => void;
    onBacktestSuccess?: (report: string) => void;
    onBacktestError?: (error: unknown) => void;
  } & RunnerCallbacks,
) => {
  const commandArg = args.at(0);
  const numThreads = commandArg ? parseInt(commandArg, 10) : null;

  let data: BacktestData | undefined;

  if (numThreads !== null && !isNaN(numThreads) && numThreads > 0) {
    callbacks.onFetchStart?.(numThreads);
    const fetchResult = await fetchBacktestThreads(numThreads, HIVE_API_URL);
    if (fetchResult.success) {
      data = fetchResult.data;
    } else {
      callbacks.onFetchError?.(fetchResult.error);
    }
  }

  // Use default dataset
  if (!data) {
    data = loadDefaultBacktest();
  }

  try {
    const result = await runBacktest(data, config, {
      onThreadStart: callbacks.onThreadStart,
      onThreadComplete: callbacks.onThreadComplete,
    });

    const report = buildTextReport(result);
    callbacks.onBacktestSuccess?.(report);
  } catch (err) {
    callbacks.onBacktestError?.(err);
  }
};
