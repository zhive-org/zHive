import { getMemoryLineCount } from '@zhive/sdk';
import { generateText } from 'ai';
import { AgentRuntime } from '../agent/runtime';
import { AssetEvaluator } from './evaluator';
import { HyperliquidExchange } from './exchange/hyperliquid';
import { IExchange } from './exchange/types';
import { loadMemory, saveMemory } from './memory';
import { RiskEngine } from './risk';
import { TradeDecision } from './types';
import { PositionNotFound, UnknownError, UnSupportedAssetError } from './exchange/error';
import { ZhiveExchange } from './exchange/zhive';

export type TradingAgentCallbacks = {
  onError?: (err: string) => void;
  onSleep?: (sleepTimeMs: number) => void;
  onEvalStarted?: (assets: string[]) => void;
  onEvalCompleted?: (decision: TradeDecision) => void;
};

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hr

export class TradingAgent {
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;
  private abortController?: AbortController | null = null;

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
    const exchange = await ZhiveExchange.create({
      apiKey: runtime.config.apiKey,
    });
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
      .catch((err) => this.callbacks.onError?.(err instanceof Error ? err.message : String(err)))
      .finally(() => this._scheduleNextRun());
  }

  stop() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
    }
    if (this.abortController) {
      this.abortController.abort();
    }
    this._timeoutId = null;
    this.abortController = null;
  }

  private async runOnce() {
    const account = await this.exchange.fetchAccountState();
    this.abortController = new AbortController();

    const assetSet = new Set([...this.watchList]);

    // Evaluate all the asset that has opened position even if asset is not in the watchlist
    for (const position of account.positions) {
      assetSet.add(position.coin);
    }

    const assets = Array.from(assetSet);
    this.callbacks.onEvalStarted?.(assets);
    const ctx = { abortSignal: this.abortController.signal };

    const decisions = await this.evaluator.evaluate(ctx, assets, account);

    for (let i = 0; i < decisions.length; i++) {
      decisions[i] = this.riskEngine.validate(decisions[i], account);
      const decision = decisions[i];
      this.callbacks?.onEvalCompleted?.(decision);
      if (decision.action !== 'HOLD') {
        try {
          await this.exchange.placeOrder(decision);
        } catch (e) {
          let message = 'Failed to execute order';
          if (e instanceof UnSupportedAssetError) {
            message = 'Unknown asset';
          } else if (e instanceof PositionNotFound) {
            message = 'Position not found';
          } else if (e instanceof UnknownError) {
            message = e.message;
          }

          this.callbacks.onError?.(message);
        }
      }
    }

    await this.saveDecisions(decisions);
    this.abortController = null;
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
