import { AccountSummary, TradeDecision } from './types';

type RiskLimit = {
  maxTotalExposureQuote: number;
  maxLeverage: number;
};

export class RiskEngine {
  constructor(private _limits: RiskLimit) {}

  get limits(): Readonly<RiskLimit> {
    return this._limits;
  }

  validate(decision: TradeDecision, account: AccountSummary): TradeDecision {
    if (decision.action === 'HOLD' || decision.action === 'CLOSE') return decision;

    if (decision.leverage > this._limits.maxLeverage) {
      return {
        ...decision,
        action: 'HOLD',
        reasoning: `Risk limit exceeded: Leverage ${decision.leverage} exceeds max ${this._limits.maxLeverage}`,
      };
    }

    const currentExposure = account.positions.reduce(
      (acc, pos) => acc + pos.entryPrice * pos.size,
      0,
    );

    const totalExposureAfter = currentExposure + decision.sizeUsd;
    if (totalExposureAfter > this._limits.maxTotalExposureQuote) {
      return {
        ...decision,
        action: 'HOLD',
        reasoning: `Risk limit exceeded: total exposure ${totalExposureAfter.toFixed(2)} USD exceeds max ${this._limits.maxTotalExposureQuote} USD`,
      };
    }

    return decision;
  }
}
