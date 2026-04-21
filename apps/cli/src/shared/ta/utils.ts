import type { MarketInterval } from '@zhive/sdk';

export interface PineResult {
  plots: Record<string, { data: Array<{ value: number | boolean | null }> }>;
  marketData: {
    openTime: number;
    open: number;
    close: number;
    closeTime: number;
    high: number;
    low: number;
  }[];
}

/**
 * Adjusts the 'from' date backwards to ensure sufficient data points are fetched
 * for indicator calculation. Adds a 30% buffer for weekends/gaps in data.
 */
export function adjustFromDate(
  from: string | Date,
  minPoints: number,
  interval: MarketInterval,
): string {
  const fromDate = new Date(from);
  const buffer = Math.ceil(minPoints * 0.3);
  const totalPoints = minPoints + buffer;

  if (interval === 'hourly') {
    fromDate.setTime(fromDate.getTime() - totalPoints * 60 * 60 * 1000);
  } else {
    fromDate.setTime(fromDate.getTime() - totalPoints * 24 * 60 * 60 * 1000);
  }

  return fromDate.toISOString();
}

export function formatPineResult({ plots, marketData }: PineResult, returnedCandleCount: number) {
  // Determine slice window: only return the most-recent return_candle_count candles
  const startIdx = Math.max(0, marketData.length - returnedCandleCount);

  // Extract plot data in a serializable format (sliced to return window).
  // PineTS exposes drawing-primitive collections (labels/lines/boxes/...) under
  // __double-underscore__ keys in the same map — skip those so callers only see plots.
  const plotData: Record<string, Array<number | boolean | null>> = {};
  for (const [plotName, plot] of Object.entries(plots)) {
    if (plotName.startsWith('__') && plotName.endsWith('__')) continue;
    plotData[plotName] = plot.data.slice(startIdx).map((d) => d.value);
  }

  return plotData;
}
