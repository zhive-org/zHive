import type { BacktestRunResult, BacktestThreadResult } from './types.js';

/**
 * Format a number with sign for display.
 */
export function formatConviction(value: number): string {
  const sign = value >= 0 ? '+' : '';
  const formatted = `${sign}${value.toFixed(2)}%`;
  return formatted;
}

/**
 * Format a percentage for display.
 */
export function formatPercentage(value: number): string {
  const formatted = `${value.toFixed(1)}%`;
  return formatted;
}

/**
 * Get direction indicator.
 */
export function getDirectionIndicator(conviction: number): string {
  if (conviction > 0) {
    return 'bullish';
  }
  if (conviction < 0) {
    return 'bearish';
  }
  return 'neutral';
}

/**
 * Format a single thread result for display.
 */
export interface FormattedThreadResult {
  index: number;
  projectName: string;
  predicted: string;
  actual: string;
  direction: string; // 'correct', 'incorrect', 'skipped'
  error: string;
  summary: string;
  thread_text: string;
}

export function formatThreadResult(result: BacktestThreadResult): FormattedThreadResult {
  if (result.skipped) {
    return {
      index: result.thread_index + 1,
      projectName: result.project_name,
      predicted: 'SKIP',
      actual: formatConviction(result.actual_price_change_percent),
      direction: 'skipped',
      error: '-',
      summary: '(skipped)',
      thread_text: result.thread_text,
    };
  }

  const directionLabel = result.direction_correct ? 'correct' : 'incorrect';

  return {
    index: result.thread_index + 1,
    projectName: result.project_name,
    predicted: formatConviction(result.predicted_conviction),
    actual: formatConviction(result.actual_price_change_percent),
    direction: directionLabel,
    error: result.absolute_error !== null ? result.absolute_error.toFixed(2) : '-',
    summary:
      result.predicted_summary.slice(0, 200) + (result.predicted_summary.length > 200 ? '...' : ''),
    thread_text: result.thread_text.slice(0, 100) + (result.thread_text.length > 100 ? '...' : ''),
  };
}

/**
 * Format the summary statistics for display.
 */
export interface FormattedSummary {
  agentName: string;
  backtestId: string;
  totalThreads: number;
  threadsPredicted: number;
  threadsSkipped: number;
  directionAccuracy: string;
  meanAbsoluteError: string;
  runAt: string;
}

export function formatSummary(result: BacktestRunResult): FormattedSummary {
  return {
    agentName: result.agent_name,
    backtestId: result.backtest_id,
    totalThreads: result.total_threads,
    threadsPredicted: result.threads_predicted,
    threadsSkipped: result.threads_skipped,
    directionAccuracy: formatPercentage(result.direction_accuracy),
    meanAbsoluteError: result.mean_absolute_error.toFixed(2),
    runAt: new Date(result.run_at).toLocaleString(),
  };
}

/**
 * Get accuracy grade based on direction accuracy percentage.
 */
export function getAccuracyGrade(accuracy: number): {
  grade: string;
  color: 'green' | 'honey' | 'red';
} {
  if (accuracy >= 70) {
    return { grade: 'A', color: 'green' };
  }
  if (accuracy >= 60) {
    return { grade: 'B', color: 'green' };
  }
  if (accuracy >= 50) {
    return { grade: 'C', color: 'honey' };
  }
  if (accuracy >= 40) {
    return { grade: 'D', color: 'red' };
  }
  return { grade: 'F', color: 'red' };
}

/**
 * Build a text report of the backtest results.
 */
export function buildTextReport(result: BacktestRunResult): string {
  const lines: string[] = [];
  const summary = formatSummary(result);

  lines.push(`Backtest Results: ${summary.backtestId}`);
  lines.push(`Agent: ${summary.agentName}`);
  lines.push(`Run at: ${summary.runAt}`);
  lines.push('');
  lines.push('--- Summary ---');
  lines.push(`Total threads: ${summary.totalThreads}`);
  lines.push(`Predictions made: ${summary.threadsPredicted}`);
  lines.push(`Skipped: ${summary.threadsSkipped}`);
  lines.push(`Direction accuracy: ${summary.directionAccuracy}`);
  lines.push(`Mean absolute error: ${summary.meanAbsoluteError}`);
  lines.push('');
  lines.push('--- Per-Thread Results ---');

  for (const threadResult of result.thread_results) {
    const formatted = formatThreadResult(threadResult);
    const directionSymbol =
      formatted.direction === 'correct'
        ? '[OK]'
        : formatted.direction === 'skipped'
          ? '[--]'
          : '[XX]';
    lines.push(
      `#${formatted.index} ${formatted.projectName}: Predicted ${formatted.predicted}, Actual ${formatted.actual} ${directionSymbol}`,
    );
    lines.push(`\tThread: ${formatted.thread_text}`);
    lines.push(`\tSummary: ${formatted.summary}`);
  }

  return lines.join('\n');
}
