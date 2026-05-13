import { describe, expect, it } from 'vitest';
import { pnlPctToPriceMovePct, stopLossTriggerPrice, takeProfitTriggerPrice } from './tp-sl';

describe('tp-sl', () => {
  it('converts PnL% on margin to underlying price-move %', () => {
    expect(pnlPctToPriceMovePct(20, 10)).toBeCloseTo(0.02, 6); // 2%
    expect(pnlPctToPriceMovePct(50, 5)).toBeCloseTo(0.1, 6); // 10%
  });

  it('long SL trigger sits below entry', () => {
    const trig = stopLossTriggerPrice(50_000, 'long', 10, 5);
    expect(trig).toBeCloseTo(50_000 * (1 - 0.02), 4);
  });

  it('short SL trigger sits above entry', () => {
    const trig = stopLossTriggerPrice(50_000, 'short', 10, 5);
    expect(trig).toBeCloseTo(50_000 * (1 + 0.02), 4);
  });

  it('long TP trigger sits above entry', () => {
    const trig = takeProfitTriggerPrice(50_000, 'long', 30, 5);
    expect(trig).toBeCloseTo(50_000 * (1 + 0.06), 4);
  });

  it('short TP trigger sits below entry', () => {
    const trig = takeProfitTriggerPrice(50_000, 'short', 30, 5);
    expect(trig).toBeCloseTo(50_000 * (1 - 0.06), 4);
  });
});
