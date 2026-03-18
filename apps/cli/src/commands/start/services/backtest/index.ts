// Types
export type {
  BacktestThread,
  BacktestMetadata,
  BacktestData,
  BacktestThreadResult,
  BacktestRunResult,
  BacktestImportFile,
  BacktestImportThread,
} from './types.js';

// Import
export { importBacktestFile, validateThreadInput, createThread } from './import.js';

// Storage
export { DEFAULT_BACKTEST_ID, loadDefaultBacktest } from './storage.js';

// Fetch
export { fetchBacktestThreads, type FetchBacktestResult } from './fetch.js';

// Runner
export { runBacktest, type RunnerConfig, type RunnerCallbacks } from './runner.js';

// Results
export {
  formatConviction,
  formatPercentage,
  getDirectionIndicator,
  formatThreadResult,
  formatSummary,
  getAccuracyGrade,
  buildTextReport,
  type FormattedThreadResult,
  type FormattedSummary,
} from './results.js';
