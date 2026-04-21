import { MarketInterval } from '@zhive/sdk';
import { PineTsTimeframe } from '../../types';

export const ZHIVE_TIMEFRAME_TO_MS: Record<string, number> = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '1d': 86_400_000,
};

export const PINETS_TO_ZHIVE_TF: Partial<Record<PineTsTimeframe, MarketInterval>> = {
  '60': 'hourly',
  D: 'daily',
  '1D': 'daily',
};
