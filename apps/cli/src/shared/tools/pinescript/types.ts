const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

export const pinetsTimeframes = [
  '1',
  '3',
  '5',
  '15',
  '30',
  '45',
  '60',
  '120',
  '180',
  '240',
  '4H',
  '1D',
  'D',
  '1W',
  'W',
  '1M',
  'M',
] as const;

export type PineTsTimeframe = (typeof pinetsTimeframes)[number];

export const PINETSTIMEFRAME_TO_MS = {
  '1': MINUTE, // 1 minute
  '3': 3 * MINUTE, // 3 minutes
  '5': 5 * MINUTE, // 5 minutes
  '15': 15 * MINUTE, // 15 minutes
  '30': 30 * MINUTE, // 30 minutes
  '45': null, // 45 minutes (not directly supported by Hyperliquid, needs custom handling)
  '60': HOUR, // 1 hour
  '120': 2 * HOUR, // 2 hours
  '180': null, // 3 hours (not directly supported by Hyperliquid, needs custom handling)
  '240': 4 * HOUR, // 4 hours
  '4H': 4 * HOUR, // 4 hours
  '1D': DAY, // 1 day
  D: DAY, // 1 day
  '1W': WEEK, // 1 week
  W: WEEK, // 1 week
  '1M': MONTH, // 1 month
  M: MONTH, // 1 month
};
