import { ExchangeClient, HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { AssetEvaluator } from './evaluator';
import { TradeExecutor } from './executor';
import { MarketService } from './market';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from 'process';
import { AgentRuntime } from '../agent/runtime';
import { AccountSummary, TradeDecision } from './types';
import { SymbolConverter } from '@nktkas/hyperliquid/utils';

export type TradingAgentCallbacks = {
  onError?: (err: unknown) => void;
  onSleep?: (sleepTimeMs: number) => void;
  onEvalStarted?: (assets: string[]) => void;
  onEvalCompleted?: (account: AccountSummary, decisions: TradeDecision[]) => void;
};

export class TradingAgent {
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;

  private constructor(
    private watchList: string[],
    private marketService: MarketService,
    private evaluator: AssetEvaluator,
    private executor: TradeExecutor,
    private address: `0x${string}`,
    private callbacks: TradingAgentCallbacks,
  ) {}

  static async create(
    watchList: string[],
    runtime: AgentRuntime,
    callbacks?: TradingAgentCallbacks,
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

    const marketSrv = new MarketService(info);
    const evaluator = new AssetEvaluator(marketSrv, runtime);
    const converter = await SymbolConverter.create({ transport });
    const executor = new TradeExecutor(exchange, info, converter);

    return new TradingAgent(watchList, marketSrv, evaluator, executor, address, callbacks ?? {});
  }

  private async _scheduleNextRun() {
    const sleepMs = 15 * 60 * 1000;
    this.callbacks.onSleep?.(sleepMs);
    this._timeoutId = setTimeout(() => {
      this.run();
    }, sleepMs);
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

    for (const decision of decisions) {
      if (decision.action !== 'HOLD') {
        await this.executor.execute(decision, account);
      }
    }
  }
}
