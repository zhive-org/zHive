import { DEFAULT_BACKTEST_DATA } from './default-backtest-data.js';
import type { BacktestData } from './types.js';

/**
 * ID for the bundled default backtest dataset.
 */
export const DEFAULT_BACKTEST_ID = 'default';

/**
 * Load the bundled default backtest dataset.
 */
export function loadDefaultBacktest(): BacktestData {
  return DEFAULT_BACKTEST_DATA;
}
