import { PineTsTimeframe } from '../../types';

export enum HyperLiquidTimeframe {
  '1m' = '1m',
  '3m' = '3m',
  '5m' = '5m',
  '15m' = '15m',
  '30m' = '30m',
  '1h' = '1h',
  '2h' = '2h',
  '4h' = '4h',
  '8h' = '8h',
  '12h' = '12h',
  '1d' = '1d',
  '3d' = '3d',
  '1w' = '1w',
  '1M' = '1M',
}

export const PINETS_TO_HYPERLIQUID_TF: Record<PineTsTimeframe, HyperLiquidTimeframe | null> = {
  '1': HyperLiquidTimeframe['1m'], // 1 minute
  '3': HyperLiquidTimeframe['3m'],
  '5': HyperLiquidTimeframe['5m'],
  '15': HyperLiquidTimeframe['15m'],
  '30': HyperLiquidTimeframe['30m'],
  '45': null, // 45 minutes (not directly supported by Hyperliquid, needs custom handling)
  '60': HyperLiquidTimeframe['1h'],
  '120': HyperLiquidTimeframe['2h'],
  '180': null, // 3 hours (not directly supported by Hyperliquid, needs custom handling)
  '240': HyperLiquidTimeframe['4h'],
  '4H': HyperLiquidTimeframe['4h'],
  '1D': HyperLiquidTimeframe['1d'],
  D: HyperLiquidTimeframe['1d'],
  '1W': HyperLiquidTimeframe['1w'],
  W: HyperLiquidTimeframe['1w'],
  '1M': HyperLiquidTimeframe['1M'],
  M: HyperLiquidTimeframe['1M'],
};
