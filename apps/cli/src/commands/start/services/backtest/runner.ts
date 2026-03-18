import { processMegathreadRound } from '../../../../shared/agent/analysis.js';
import { initializeAgentRuntime } from '../../../../shared/agent/runtime.js';
import type {
  BacktestData,
  BacktestRunResult,
  BacktestThread,
  BacktestThreadResult,
} from './types.js';

export interface RunnerConfig {
  agentPath: string;
  soulContent: string;
  strategyContent: string;
  agentName: string;
}

export interface RunnerCallbacks {
  onThreadStart?: (index: number, total: number, thread: BacktestThread) => void;
  onThreadComplete?: (index: number, result: BacktestThreadResult) => void;
}

/**
 * Run a backtest against an agent configuration.
 */
export async function runBacktest(
  backtest: BacktestData,
  config: RunnerConfig,
  callbacks?: RunnerCallbacks,
): Promise<BacktestRunResult> {
  const runtime = await initializeAgentRuntime(config.agentPath);
  const threads = backtest.threads;
  const results: BacktestThreadResult[] = [];

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    callbacks?.onThreadStart?.(i, threads.length, thread);

    // Run megathread analysis
    const defaultDurationMs = 3 * 60 * 60 * 1000; // 3h default backtest window
    const analysisResult = await processMegathreadRound({
      projectId: thread.project_id,
      durationMs: defaultDurationMs,
      recentComments: [],
      agentRuntime: runtime,
      priceAtStart: thread.price_on_fetch,
      currentPrice: thread.price_on_eval,
    });

    // Calculate actual price change
    const actualPriceChangePercent = calculatePriceChange(
      thread.price_on_fetch,
      thread.price_on_eval,
    );

    // Build result
    const result = buildThreadResult(i, thread, analysisResult, actualPriceChangePercent);
    results.push(result);

    callbacks?.onThreadComplete?.(i, result);
  }

  // Calculate summary statistics
  const runResult = buildRunResult(backtest.metadata.id, runtime.config.name, results);
  return runResult;
}

/**
 * Calculate percentage price change.
 */
function calculatePriceChange(priceOnFetch: number, priceOnEval: number): number {
  const change = ((priceOnEval - priceOnFetch) / priceOnFetch) * 100;
  return change;
}

/**
 * Build a thread result from analysis output.
 */
function buildThreadResult(
  index: number,
  thread: BacktestThread,
  analysis: { skip: boolean; summary: string; conviction: number },
  actualPriceChangePercent: number,
): BacktestThreadResult {
  if (analysis.skip) {
    return {
      thread_index: index,
      project_id: thread.project_id,
      project_name: thread.project_name,
      thread_text: thread.text,
      predicted_conviction: 0,
      predicted_summary: '',
      skipped: true,
      actual_price_change_percent: actualPriceChangePercent,
      direction_correct: null,
      absolute_error: null,
    };
  }

  // Determine direction correctness
  const predictedDirection = Math.sign(analysis.conviction);
  const actualDirection = Math.sign(actualPriceChangePercent);
  const directionCorrect = predictedDirection === actualDirection;

  // Calculate absolute error
  const absoluteError = Math.abs(analysis.conviction - actualPriceChangePercent);

  return {
    thread_index: index,
    project_id: thread.project_id,
    project_name: thread.project_name,
    thread_text: thread.text,
    predicted_conviction: analysis.conviction,
    predicted_summary: analysis.summary,
    skipped: false,
    actual_price_change_percent: actualPriceChangePercent,
    direction_correct: directionCorrect,
    absolute_error: absoluteError,
  };
}

/**
 * Build the final run result with summary statistics.
 */
function buildRunResult(
  backtestId: string,
  agentName: string,
  results: BacktestThreadResult[],
): BacktestRunResult {
  const totalThreads = results.length;
  const predictedResults = results.filter((r) => !r.skipped);
  const threadsPredicted = predictedResults.length;
  const threadsSkipped = totalThreads - threadsPredicted;

  // Calculate direction accuracy
  const correctDirections = predictedResults.filter((r) => r.direction_correct === true).length;
  const directionAccuracy = threadsPredicted > 0 ? (correctDirections / threadsPredicted) * 100 : 0;

  // Calculate mean absolute error
  const totalError = predictedResults.reduce((sum, r) => sum + (r.absolute_error ?? 0), 0);
  const meanAbsoluteError = threadsPredicted > 0 ? totalError / threadsPredicted : 0;

  return {
    backtest_id: backtestId,
    agent_name: agentName,
    run_at: new Date().toISOString(),
    thread_results: results,
    total_threads: totalThreads,
    threads_predicted: threadsPredicted,
    threads_skipped: threadsSkipped,
    direction_accuracy: directionAccuracy,
    mean_absolute_error: meanAbsoluteError,
  };
}
