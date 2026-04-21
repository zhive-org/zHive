const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

const TIMEFRAME_TO_MS = {
  '1': MINUTE, // 1 minute
  '3': 3 * MINUTE, // 3 minutes
  '5': 5 * MINUTE, // 5 minutes
  '15': 15 * MINUTE, // 15 minutes
  '30': 30 * MINUTE, // 30 minutes
  '45': null, // 45 minutes (not directly supported by Binance, needs custom handling)
  '60': '1h', // 1 hour
  '120': '2h', // 2 hours
  '180': null, // 3 hours (not directly supported by Binance, needs custom handling)
  '240': '4h', // 4 hours
  '4H': '4h', // 4 hours
  '1D': '1d', // 1 day
  D: '1d', // 1 day
  '1W': '1w', // 1 week
  W: '1w', // 1 week
  '1M': '1M', // 1 month
  M: '1M', // 1 month
};
