import { getMemoryLineCount } from '@zhive/sdk';
import { generateText } from 'ai';
import { AgentRuntime } from '../agent/runtime';
import { AssetEvaluator } from './evaluator';
import { HyperliquidExchange } from './exchange/hyperliquid';
import { IExchange } from './exchange/types';
import { loadMemory, saveMemory } from './memory';
import { RiskEngine } from './risk';
import { TradeDecision } from './types';

export type TradingAgentCallbacks = {
  onError?: (err: unknown) => void;
  onSleep?: (sleepTimeMs: number) => void;
  onEvalStarted?: (assets: string[]) => void;
  onEvalCompleted?: (decision: TradeDecision) => void;
};

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hr

export class TradingAgent {
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;

  private constructor(
    private runtime: AgentRuntime,
    private watchList: string[],
    private evaluator: AssetEvaluator,
    private exchange: IExchange,
    private riskEngine: RiskEngine,
    private callbacks: TradingAgentCallbacks,
    private intervalMs: number = DEFAULT_INTERVAL_MS,
  ) {}

  static async create(
    watchList: string[],
    runtime: AgentRuntime,
    config?: TradingAgentCallbacks & {
      intervalMs?: number;
    },
  ): Promise<TradingAgent> {
    const riskEngine = new RiskEngine({
      maxLeverage: 1,
      maxTotalExposureQuote: 1000,
    });
    const exchange = await HyperliquidExchange.create();
    const evaluator = new AssetEvaluator(exchange, riskEngine, runtime);

    return new TradingAgent(
      runtime,
      watchList,
      evaluator,
      exchange,
      riskEngine,
      config ?? {},
      config?.intervalMs,
    );
  }

  private async _scheduleNextRun() {
    this.callbacks.onSleep?.(this.intervalMs);
    this._timeoutId = setTimeout(() => {
      this.run();
    }, this.intervalMs);
  }

  async run() {
    this.runOnce()
      .catch((e) => this.callbacks.onError?.(e))
      .finally(() => this._scheduleNextRun());
  }

  stop() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
    }
  }

  private async runOnce() {
    const account = await this.exchange.fetchAccountState();

    this.callbacks.onEvalStarted?.(this.watchList);
    const decisions = await this.evaluator.evaluate(this.watchList, account);

    for (let i = 0; i < decisions.length; i++) {
      decisions[i] = this.riskEngine.validate(decisions[i], account);

      const decision = decisions[i];
      if (decision.action !== 'HOLD') {
        const res = await this.exchange.placeOrder(decision);
        if (!res.success) {
          this.callbacks.onError?.(new Error(res.details));
        }
      }
      this.callbacks?.onEvalCompleted?.(decision);
    }

    await this.saveDecisions(decisions);
  }

  private async saveDecisions(decisions: TradeDecision[]): Promise<void> {
    const memory = await loadMemory('trade-decisions.md');
    const timestamp = new Date().toISOString();
    const newEntry =
      `## ${timestamp}\n\n` +
      decisions.map((d) => `- ${d.coin}: ${d.action} $${d.sizeUsd} (${d.reasoning})`).join('\n') +
      '\n\n';
    let updatedMemory = memory + newEntry;
    const lineCount = getMemoryLineCount(updatedMemory);
    if (lineCount > 200) {
      updatedMemory = await this.compactDecisions(updatedMemory);
    }
    await saveMemory('trade-decisions.md', updatedMemory);
  }

  private async compactDecisions(content: string): Promise<string> {
    const prompt = `The following is a trading log of past decisions. Please summarize the key points in a concise manner, keeping the most recent information and removing redundant entries. The goal is to reduce the total line count while preserving important context for future reference.\n\n${content}`;

    const { text } = await generateText({
      model: this.runtime.model,
      prompt,
    });

    return text;
  }
}
