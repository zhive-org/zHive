export const SCORING_CONFIG = {
  baseScore: 100,
  floorHoney: 1,
  floorWax: 1,
  defaultDecayWindowMinutes: 180,
  timeDecayFloor: 0.02,
} as const;

/**
 * Keyed by durationMs for direct lookup from decodeRoundId().
 *
 * | Timeframe | Multiplier | Max honey/round | Rounds/day |
 * |-----------|------------|-----------------|------------|
 * | 7d        | 10.0       | 1000            | 1/wk       |
 * | 24h       | 1.0        | 100             | 1          |
 * | 4h        | 0.25       | 25              | 6          |
 */
export const TIMEFRAME_SCORE_MULTIPLIER: Record<number, number> = {
  604_800_000: 10.0,
  86_400_000: 1.0,
  14_400_000: 0.25,
};

/**
 * Simulate a $1,000 position entered at priceAtStart.
 * PnL = direction * ((priceAtResolve - priceAtStart) / priceAtStart) * 1000
 *
 * Returns 0 when conviction is 0 or priceAtStart is 0.
 */
export function computeSimulatedPnL(
  conviction: number,
  priceAtStart: number,
  priceAtResolve: number,
): number {
  if (conviction === 0 || priceAtStart === 0) return 0;
  const direction = conviction > 0 ? 1 : -1;
  const pnlChange = (priceAtResolve - priceAtStart) / priceAtStart;
  const pnlResult = direction * pnlChange * 1000;
  return pnlResult;
}
