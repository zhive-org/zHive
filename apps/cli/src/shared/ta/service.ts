import { rsi, sma, ema, macd, bb } from 'indicatorts';
import type { MarketInterval } from '@zhive/sdk';
import { getHiveClient } from '../config/hive-client';
import { InsufficientDataError } from './error';
import { adjustFromDate } from './utils';
import { PineTsTimeframe } from '../tools/pinescript/types';

export type IndicatorValue = {
  timestamp: string;
  value: number;
};

export type MACDValue = {
  timestamp: string;
  macd: number;
  signal: number;
  histogram: number;
};

export type BollingerBandsValue = {
  timestamp: string;
  upper: number;
  middle: number;
  lower: number;
};

const INTERVAL_MS: Record<string, number> = {
  hourly: 3_600_000,
  daily: 86_400_000,
};

export const getPrice = async ({ project, at }: { project: string; at?: string | Date }) => {
  const client = getHiveClient().market;
  const priceData = await client.getPrice(project, at ?? new Date());
  return priceData.price ?? undefined;
};

export const convertTimeframeToInterval = (tf: PineTsTimeframe): MarketInterval => {
  const intervalMap: Partial<Record<PineTsTimeframe, MarketInterval>> = {
    '60': 'hourly',
    D: 'daily',
  };
  const interval = intervalMap[tf];
  if (!interval) {
    throw new Error(
      `Unsupported timeframe "${tf}". Supported timeframes: ${Object.keys(intervalMap).join(', ')}`,
    );
  }

  return interval;
};

export const getIntervalMs = (interval: MarketInterval): number => {
  return INTERVAL_MS[interval];
};

export const getOHLC = async ({
  project,
  from,
  to,
  interval = 'daily',
}: {
  project: string;
  interval?: MarketInterval;
  from: string | Date;
  to: string | Date;
}) => {
  const client = getHiveClient().market;
  const ohlcData = await client.getOHLC(project, from, to, interval);
  return ohlcData;
};

export const getRSI = async ({
  project,
  interval = 'daily',
  period = 14,
  from,
  to,
}: {
  period?: number;
  project: string;
  interval?: MarketInterval;
  from: string | Date;
  to: string | Date;
}): Promise<IndicatorValue[]> => {
  const market = getHiveClient().market;

  const adjustedFrom = adjustFromDate(from, period, interval);

  const ohlcData = await market.getOHLC(project, adjustedFrom, to, interval);
  if (ohlcData.length < period) {
    throw new InsufficientDataError(period, ohlcData.length);
  }

  const rsiData = rsi(
    ohlcData.map((data) => data[4]),
    { period },
  );

  const results = rsiData.map((value, i) => ({
    value,
    timestamp: new Date(ohlcData[i]?.[0] ?? 0).toISOString(),
  }));

  return results;
};

export const getSMA = async ({
  project,
  interval = 'daily',
  period = 20,
  from,
  to,
}: {
  period?: number;
  project: string;
  interval?: MarketInterval;
  from: string | Date;
  to: string | Date;
}): Promise<IndicatorValue[]> => {
  const market = getHiveClient().market;

  const adjustedFrom = adjustFromDate(from, period, interval);

  const ohlcData = await market.getOHLC(project, adjustedFrom, to, interval);
  if (ohlcData.length < period) {
    throw new InsufficientDataError(period, ohlcData.length);
  }

  const closePrices = ohlcData.map((data) => data[4]);
  const smaData = sma(closePrices, { period });

  const results = smaData.map((value, i) => ({
    value,
    timestamp: new Date(ohlcData[i]?.[0] ?? 0).toISOString(),
  }));

  return results;
};

export const getEMA = async ({
  project,
  interval = 'daily',
  period = 12,
  from,
  to,
}: {
  period?: number;
  project: string;
  interval?: MarketInterval;
  from: string | Date;
  to: string | Date;
}): Promise<IndicatorValue[]> => {
  const market = getHiveClient().market;

  const adjustedFrom = adjustFromDate(from, period, interval);

  const ohlcData = await market.getOHLC(project, adjustedFrom, to, interval);
  if (ohlcData.length < period) {
    throw new InsufficientDataError(period, ohlcData.length);
  }

  const closePrices = ohlcData.map((data) => data[4]);
  const emaData = ema(closePrices, { period });

  const results = emaData.map((value, i) => ({
    value,
    timestamp: new Date(ohlcData[i]?.[0] ?? 0).toISOString(),
  }));

  return results;
};

export const getMACD = async ({
  project,
  interval = 'daily',
  fast = 12,
  slow = 26,
  signal = 9,
  from,
  to,
}: {
  fast?: number;
  slow?: number;
  signal?: number;
  project: string;
  interval?: MarketInterval;
  from: string | Date;
  to: string | Date;
}): Promise<MACDValue[]> => {
  const market = getHiveClient().market;

  const minRequired = slow + signal;
  const adjustedFrom = adjustFromDate(from, minRequired, interval);

  const ohlcData = await market.getOHLC(project, adjustedFrom, to, interval);
  if (ohlcData.length < minRequired) {
    throw new InsufficientDataError(minRequired, ohlcData.length);
  }

  const closePrices = ohlcData.map((data) => data[4]);
  const macdResult = macd(closePrices, { fast, slow, signal });

  const results = macdResult.macdLine.map((macdVal, i) => ({
    timestamp: new Date(ohlcData[i]?.[0] ?? 0).toISOString(),
    macd: macdVal,
    signal: macdResult.signalLine[i],
    histogram: macdVal - macdResult.signalLine[i],
  }));

  return results;
};

export const getBollingerBands = async ({
  project,
  interval = 'daily',
  period = 20,
  from,
  to,
}: {
  period?: number;
  project: string;
  interval?: MarketInterval;
  from: string | Date;
  to: string | Date;
}): Promise<BollingerBandsValue[]> => {
  const market = getHiveClient().market;

  const adjustedFrom = adjustFromDate(from, period, interval);

  const ohlcData = await market.getOHLC(project, adjustedFrom, to, interval);
  if (ohlcData.length < period) {
    throw new InsufficientDataError(period, ohlcData.length);
  }

  const closePrices = ohlcData.map((data) => data[4]);
  const bbResult = bb(closePrices, { period });

  const results = bbResult.upper.map((upper, i) => ({
    timestamp: new Date(ohlcData[i]?.[0] ?? 0).toISOString(),
    upper,
    middle: bbResult.middle[i],
    lower: bbResult.lower[i],
  }));

  return results;
};
