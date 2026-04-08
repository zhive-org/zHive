import { ExchangeClient, HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { SymbolConverter } from '@nktkas/hyperliquid/utils';
import { privateKeyToAccount } from 'viem/accounts';
import { AgentRuntime } from '../agent/runtime';
import { AssetEvaluator } from './evaluator';
import { TradeExecutor } from './executor';
import { HyperliquidMarketService } from './market';
import { AccountSummary, ExecutionResult, TradeDecision } from './types';
import { loadMemory, saveMemory } from './memory';
import { getMemoryLineCount } from '@zhive/sdk';
import { generateText } from 'ai';

export type TradingAgentCallbacks = {
  onError?: (err: unknown) => void;
  onSleep?: (sleepTimeMs: number) => void;
  onEvalStarted?: (assets: string[]) => void;
  onEvalCompleted?: (account: AccountSummary, decisions: TradeDecision[]) => void;
};

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hr

export class TradingAgent {
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;

  private constructor(
    private runtime: AgentRuntime,
    private watchList: string[],
    private marketService: HyperliquidMarketService,
    private evaluator: AssetEvaluator,
    private executor: TradeExecutor,
    private address: `0x${string}`,
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
    const transport = new HttpTransport({ isTestnet: true });
    const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not set');
    }
    const address = process.env.WALLET_ADDRESS as `0x${string}`;
    if (!address) {
      throw new Error(`WALLET_ADDRESS not set`);
    }
    const wallet = privateKeyToAccount(privateKey);
    const info = new InfoClient({ transport });
    const exchange = new ExchangeClient({ transport, wallet });

    const marketSrv = new HyperliquidMarketService(info);
    const evaluator = new AssetEvaluator(marketSrv, runtime);
    const converter = await SymbolConverter.create({ transport });
    const executor = new TradeExecutor(exchange, info, converter);

    return new TradingAgent(
      runtime,
      watchList,
      marketSrv,
      evaluator,
      executor,
      address,
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
    const account = await this.marketService.fetchAccountState(this.address);
    this.callbacks.onEvalStarted?.(this.watchList);
    const decisions = await this.evaluator.evaluate(this.watchList, account);
    this.callbacks.onEvalCompleted?.(account, decisions);
    await this.saveDecisions(decisions);

    for (const decision of decisions) {
      if (decision.action === 'HOLD') continue;
      const res = await this.executor.execute(decision, account);

      if (!res.success) {
        this.callbacks.onError?.(new Error(res.details));
      }
    }
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
