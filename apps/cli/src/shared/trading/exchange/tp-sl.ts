/**
 * TP/SL trigger-price math shared by all exchange implementations.
 *
 * Convention: `sl` and `tp` on TradeDecision are PnL % on margin (leverage-adjusted).
 * Example: sl=10 at leverage=10 triggers on a 1% adverse price move.
 *
 *   priceMove% = pnl% / leverage
 */

export type Side = 'long' | 'short';

export function pnlPctToPriceMovePct(pnlPct: number, leverage: number): number {
  return pnlPct / leverage / 100;
}

/**
 * SL triggers when price moves AGAINST the position.
 * - long: triggerPrice < entryPrice
 * - short: triggerPrice > entryPrice
 */
export function stopLossTriggerPrice(
  entryPrice: number,
  side: Side,
  slPnlPct: number,
  leverage: number,
): number {
  const move = pnlPctToPriceMovePct(slPnlPct, leverage);
  const sl = side === 'long' ? entryPrice * (1 - move) : entryPrice * (1 + move);
  return Math.max(sl, 0);
}

/**
 * TP triggers when price moves IN FAVOR of the position.
 * - long: triggerPrice > entryPrice
 * - short: triggerPrice < entryPrice
 */
export function takeProfitTriggerPrice(
  entryPrice: number,
  side: Side,
  tpPnlPct: number,
  leverage: number,
): number {
  const move = pnlPctToPriceMovePct(tpPnlPct, leverage);
  const tp = side === 'long' ? entryPrice * (1 + move) : entryPrice * (1 - move);
  return Math.max(tp, 0);
}
