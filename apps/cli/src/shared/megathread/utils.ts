export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function humanDuration(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (hours >= 1) {
    const rounded = Math.round(hours);
    return rounded === 1 ? '1 hour' : `${rounded} hours`;
  }
  const minutes = Math.round(ms / 60_000);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

export function formatTimeLeft(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return '<1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export function convictionColor(conviction: number): string {
  if (conviction > 0) return 'green';
  if (conviction < 0) return 'red';
  return 'gray';
}

export function extractErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message;
}

export function formatTokenCount(n: number): string {
  const formatted = n.toLocaleString('en-US');
  return formatted;
}

export interface TokenUsageSummary {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  toolCalls: number;
  toolNames: string[];
}

export function formatTokenUsage(usage: TokenUsageSummary): {
  input: string;
  output: string;
  tools: string | null;
} {
  let input = `input: ${formatTokenCount(usage.inputTokens)}`;
  if (usage.cacheReadTokens > 0) {
    const newTokens = usage.inputTokens - usage.cacheReadTokens;
    input += ` (${formatTokenCount(newTokens)} new, ${formatTokenCount(usage.cacheReadTokens)} cached)`;
  } else if (usage.cacheWriteTokens > 0) {
    input += ` (${formatTokenCount(usage.cacheWriteTokens)} cache write)`;
  }
  const output = `output: ${formatTokenCount(usage.outputTokens)}`;
  const tools = usage.toolCalls > 0 ? `tools: ${usage.toolNames.join(', ')}` : null;
  return { input, output, tools };
}

export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fencePattern = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/;
  const match = trimmed.match(fencePattern);
  if (match) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * Truncate a timeseries array for display, keeping head and tail with a `null` gap in between.
 * Returns the original array unchanged if it fits within `maxDisplay`.
 */
export function truncateTimeseries<T>(
  data: T[],
  {
    maxDisplay = 20,
    headCount = 5,
    tailCount = 10,
  }: {
    maxDisplay?: number;
    headCount?: number;
    tailCount?: number;
  } = {},
): (T | null)[] {
  if (data.length <= maxDisplay) {
    return data;
  }
  const truncated: (T | null)[] = [...data.slice(0, headCount), null, ...data.slice(-tailCount)];
  return truncated;
}

/**
 * Label for the truncation gap (e.g. `"... (42 more points) ..."`).
 */
export function truncationLabel(totalLength: number, shownCount: number): string {
  const hidden = totalLength - shownCount;
  const label = `... (${hidden} more) ...`;
  return label;
}

/**
 * Standardised error message for tool catch blocks.
 */
export function formatToolError(err: unknown, context: string): string {
  const message = extractErrorMessage(err);
  const result = `Error ${context}: ${message}`;
  return result;
}

/**
 * Returns '+' for non-negative values, '' for negative (the minus sign is already present).
 */
export function signPrefix(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return prefix;
}

/**
 * Format a period-change percentage from first → last value.
 * Returns e.g. `"Period change: +12.34%"`.
 */
export function formatPeriodChange(firstValue: number, lastValue: number): string {
  const changePercent = ((lastValue - firstValue) / firstValue) * 100;
  const sign = signPrefix(changePercent);
  const result = `Period change: ${sign}${changePercent.toFixed(2)}%`;
  return result;
}
