import { Timeframe } from './types';

export function timeframeToMs(tf: Timeframe): number {
  const match = tf.match(/^(\d+)(m|h|d|w|M)$/);
  if (!match) throw new Error(`Invalid timeframe: ${tf}`);

  const [, value, unit] = match;
  const n = parseInt(value, 10);

  switch (unit) {
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
      return n * 86_400_000;
    case 'w':
      return n * 7 * 86_400_000;
    case 'M':
      return n * 30 * 86_400_000; // approximate
    default:
      throw new Error(`Unknown unit: ${unit}`);
  }
}
