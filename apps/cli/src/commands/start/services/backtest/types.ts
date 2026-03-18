import { CitationDto, Conviction } from '@zhive/sdk';

/**
 * A thread with the resolved outcome price for backtesting.
 * Similar to ThreadDto but without server-side fields (id, pollen_id, locked, created_at, updated_at)
 * and with price_on_eval required.
 */
export interface BacktestThread {
  project_id: string;
  project_name: string;
  project_symbol?: string;
  project_categories?: string[];
  project_description?: string;
  text: string;
  timestamp: string; // ISO 8601 date string
  price_on_fetch: number;
  /**
   * The price at the time of evaluation (3 hours after signal).
   * Required for calculating actual price change.
   */
  price_on_eval: number;
  citations: CitationDto[];
}

/**
 * Metadata about a backtest dataset.
 */
export interface BacktestMetadata {
  id: string;
  name?: string;
  created_at: string; // ISO 8601
}

/**
 * Complete backtest dataset stored in ~/.zhive/backtests/<id>/backtest.json
 */
export interface BacktestData {
  metadata: BacktestMetadata;
  threads: BacktestThread[];
}

/**
 * Result of running one thread through the agent.
 */
export interface BacktestThreadResult {
  thread_index: number;
  project_id: string;
  project_name: string;
  predicted_conviction: Conviction;
  predicted_summary: string;
  skipped: boolean;
  thread_text: string;
  actual_price_change_percent: number;
  direction_correct: boolean | null; // null if skipped
  absolute_error: number | null; // null if skipped
}

/**
 * Summary result of running all threads through an agent.
 */
export interface BacktestRunResult {
  backtest_id: string;
  agent_name: string;
  run_at: string; // ISO 8601
  thread_results: BacktestThreadResult[];
  total_threads: number;
  threads_predicted: number;
  threads_skipped: number;
  direction_accuracy: number; // 0-100 percentage
  mean_absolute_error: number;
}

/**
 * Input format for JSON file import.
 */
export interface BacktestImportFile {
  name?: string;
  threads: BacktestImportThread[];
}

/**
 * Thread format in imported JSON files.
 */
export interface BacktestImportThread {
  project_id: string;
  project_name: string;
  text: string;
  timestamp?: string; // ISO 8601, defaults to current time
  price_on_fetch: number;
  price_on_eval: number;
  project_symbol?: string;
  project_categories?: string[];
  project_description?: string;
  citations?: Array<{ url?: string; title: string }>;
}
