import type { MarketInterval } from '@zhive/sdk';

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
