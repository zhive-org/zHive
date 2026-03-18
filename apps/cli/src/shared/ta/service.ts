import { rsi, sma, ema, macd, bb } from 'indicatorts';
import { getMarketClient, MarketInterval } from '../agent/tools/market/client.js';
import { InsufficientDataError, PriceUnavailableError } from './error.js';
import { adjustFromDate } from './utils.js';

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

export const getPrice = async ({ project, at }: { project: string; at?: string | Date }) => {
  const client = getMarketClient();
  const priceData = await client.getPrice(project, at ?? new Date());
  return priceData.price ?? undefined;
};

export const getOHLC = async ({
  project,
  from,
  to,
  interval = 'hourly',
}: {
  project: string;
  interval?: MarketInterval;
  from: string | Date;
  to: string | Date;
}) => {
  const client = getMarketClient();
  const ohlcData = await client.getOHLC(project, from, to, interval);
  return ohlcData;
};

export const getRSI = async ({
  project,
  interval = 'hourly',
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
  const market = getMarketClient();

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
  interval = 'hourly',
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
  const market = getMarketClient();

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
  interval = 'hourly',
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
  const market = getMarketClient();

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
  interval = 'hourly',
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
  const market = getMarketClient();

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
  interval = 'hourly',
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
  const market = getMarketClient();

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
