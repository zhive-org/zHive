import { tool } from 'ai';
import { z } from 'zod';
import { InsufficientDataError } from '../../../ta/error.js';
import {
  getBollingerBands,
  getEMA,
  getMACD,
  getOHLC,
  getPrice,
  getRSI,
  getSMA,
} from '../../../ta/service.js';
import type { MarketInterval } from '@zhive/sdk';
import {
  formatBollingerData,
  formatIndicatorData,
  formatMACDData,
  formatOhlcData,
} from './utils.js';
import { formatToolError } from '../../utils.js';

const timeRangeSchema = z.object({
  from: z
    .string()
    .describe(
      'Start date in ISO 8601 format. Use recent dates relative to the current date from context (e.g., "2024-01-01T00:00:00Z")',
    ),
  to: z
    .string()
    .describe(
      'End date in ISO 8601 format. Use the current date from context as the end date. (e.g., "2024-01-01T00:00:00Z")',
    ),
});

export const getOHLCTool = tool({
  description:
    'Get historical OHLC (Open, High, Low, Close) candlestick data for a cryptocurrency. Use this to analyze price history and patterns.',
  inputSchema: z.object({
    ...timeRangeSchema.shape,
    id: z.string().describe('Coin ID (e.g., "bitcoin", "ethereum"). Use lowercase.'),
    interval: z
      .enum(['daily', 'hourly'])
      .optional()
      .describe('Data interval: "daily" or "hourly". Defaults to "daily".'),
  }),
  execute: async ({ id, from, to, interval }) => {
    try {
      const effectiveInterval: MarketInterval = interval ?? 'daily';
      const ohlcData = await getOHLC({
        project: id,
        from,
        to,
        interval: effectiveInterval,
      });

      if (ohlcData.length === 0) {
        return `No OHLC data available for ${id} from ${from} to ${to}.`;
      }

      return formatOhlcData(ohlcData);
    } catch (err) {
      return formatToolError(err, 'fetching OHLC data');
    }
  },
});

export const getSMATool = tool({
  description:
    'Calculate Simple Moving Average (SMA) for a cryptocurrency. SMA smooths price data by averaging prices over a specified period. Commonly used periods: 20 (short-term), 50 (medium-term), 200 (long-term).',
  inputSchema: z.object({
    ...timeRangeSchema.shape,
    id: z.string().describe('Coin ID (e.g., "bitcoin", "ethereum"). Use lowercase.'),
    period: z
      .number()
      .int()
      .min(2)
      .max(200)
      .describe('Number of periods for the SMA (e.g., 20, 50, 200).'),
    interval: z
      .enum(['daily', 'hourly'])
      .optional()
      .describe('Data interval: "daily" or "hourly". Defaults to "daily".'),
  }),
  execute: async ({ id, period, from, to, interval }) => {
    try {
      const smaResult = await getSMA({
        project: id,
        interval,
        from,
        to,
        period,
      });

      return formatIndicatorData(smaResult);
    } catch (e) {
      if (e instanceof InsufficientDataError) {
        return `Insufficient data: got ${e.got} data points but need at least ${e.required} for SMA${period}.`;
      }
      return formatToolError(e, 'calculating SMA');
    }
  },
});

export const getEMATool = tool({
  description:
    'Calculate Exponential Moving Average (EMA) for a cryptocurrency. EMA gives more weight to recent prices, making it more responsive than SMA. Common periods: 12, 26 (for MACD), 9 (signal line), 20, 50, 200.',
  inputSchema: z.object({
    ...timeRangeSchema.shape,
    id: z.string().describe('Coin ID (e.g., "bitcoin", "ethereum"). Use lowercase.'),
    period: z
      .number()
      .int()
      .min(2)
      .max(200)
      .describe('Number of periods for the EMA (e.g., 12, 26, 50, 200).'),
    interval: z
      .enum(['daily', 'hourly'])
      .optional()
      .describe('Data interval: "daily" or "hourly". Defaults to "daily".'),
  }),
  execute: async ({ id, period, from, to, interval }) => {
    try {
      const emaResult = await getEMA({
        project: id,
        interval,
        from,
        to,
        period,
      });

      return formatIndicatorData(emaResult);
    } catch (e) {
      if (e instanceof InsufficientDataError) {
        return `Insufficient data: got ${e.got} data points but need at least ${e.required} for EMA${period}.`;
      }
      return formatToolError(e, 'calculating EMA');
    }
  },
});

export const getRSITool = tool({
  description:
    'Calculate Relative Strength Index (RSI) for a cryptocurrency. RSI measures momentum on a 0-100 scale. Readings above 70 suggest overbought conditions; below 30 suggests oversold. Standard period is 14.',
  inputSchema: z.object({
    ...timeRangeSchema.shape,
    id: z.string().describe('Coin ID (e.g., "bitcoin", "ethereum"). Use lowercase.'),
    period: z.number().int().min(2).max(50).optional().describe('RSI period. Defaults to 14.'),
    interval: z
      .enum(['daily', 'hourly'])
      .optional()
      .describe('Data interval: "daily" or "hourly". Defaults to "daily".'),
  }),
  execute: async ({ id, period, from, to, interval }) => {
    const effectivePeriod = period ?? 14;

    try {
      const rsi = await getRSI({
        project: id,
        interval,
        from,
        to,
        period: effectivePeriod,
      });

      return formatIndicatorData(rsi);
    } catch (e) {
      if (e instanceof InsufficientDataError) {
        return `Insufficient data: got ${e.got} data points but need at least ${e.required} for RSI${effectivePeriod}.`;
      }
      return formatToolError(e, 'calculating RSI');
    }
  },
});

export const getMACDTool = tool({
  description:
    'Calculate MACD (Moving Average Convergence Divergence) for a cryptocurrency. MACD is a trend-following momentum indicator. Standard settings: fast=12, slow=26, signal=9. Bullish when MACD crosses above signal line; bearish when below.',
  inputSchema: z.object({
    ...timeRangeSchema.shape,
    id: z.string().describe('Coin ID (e.g., "bitcoin", "ethereum"). Use lowercase.'),
    fastPeriod: z
      .number()
      .int()
      .min(2)
      .max(50)
      .optional()
      .describe('Fast EMA period. Defaults to 12.'),
    slowPeriod: z
      .number()
      .int()
      .min(2)
      .max(100)
      .optional()
      .describe('Slow EMA period. Defaults to 26.'),
    signalPeriod: z
      .number()
      .int()
      .min(2)
      .max(50)
      .optional()
      .describe('Signal line EMA period. Defaults to 9.'),
    interval: z
      .enum(['daily', 'hourly'])
      .optional()
      .describe('Data interval: "daily" or "hourly". Defaults to "daily".'),
  }),
  execute: async ({ id, fastPeriod, slowPeriod, signalPeriod, from, to, interval }) => {
    const fast = fastPeriod ?? 12;
    const slow = slowPeriod ?? 26;
    const signal = signalPeriod ?? 9;

    try {
      const macdResult = await getMACD({
        project: id,
        interval,
        from,
        to,
        fast,
        slow,
        signal,
      });

      return formatMACDData(macdResult);
    } catch (e) {
      if (e instanceof InsufficientDataError) {
        return `Insufficient data: got ${e.got} data points but need at least ${e.required} for MACD(${fast},${slow},${signal}).`;
      }
      return formatToolError(e, 'calculating MACD');
    }
  },
});

export const getBollingerTool = tool({
  description:
    'Calculate Bollinger Bands for a cryptocurrency. Bollinger Bands consist of a middle SMA band with upper and lower bands based on standard deviation. Price near upper band may indicate overbought; near lower band may indicate oversold. Standard settings: period=20, stdDev=2.',
  inputSchema: z.object({
    ...timeRangeSchema.shape,
    id: z.string().describe('Coin ID (e.g., "bitcoin", "ethereum"). Use lowercase.'),
    period: z
      .number()
      .int()
      .min(2)
      .max(100)
      .optional()
      .describe('SMA period for the middle band. Defaults to 20.'),
    interval: z
      .enum(['daily', 'hourly'])
      .optional()
      .describe('Data interval: "daily" or "hourly". Defaults to "daily".'),
  }),
  execute: async ({ id, period, from, to, interval }) => {
    const effectivePeriod = period ?? 20;

    try {
      const bbResult = await getBollingerBands({
        project: id,
        interval,
        from,
        to,
        period: effectivePeriod,
      });

      return formatBollingerData(bbResult);
    } catch (e) {
      if (e instanceof InsufficientDataError) {
        return `Insufficient data: got ${e.got} data points but need at least ${e.required} for Bollinger Bands(${effectivePeriod}).`;
      }
      return formatToolError(e, 'calculating Bollinger Bands');
    }
  },
});

/**
 * All market tools for export.
 */
export const marketTools = {
  getOHLC: getOHLCTool,
  getSMA: getSMATool,
  getEMA: getEMATool,
  getRSI: getRSITool,
  getMACD: getMACDTool,
  getBollinger: getBollingerTool,
};
