import * as ai from 'ai';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import { AgentRuntime } from '../agent/runtime';
import { createPineScriptTool, createPineScriptToolForAsset } from '../tools/pinescript';
import { IExchange } from './exchange/types';
import { PairInfo } from './types';
import { cacheableSystem } from '../agent';

const { ToolLoopAgent } = wrapAISDK(ai);

const SYSTEM_PROMPT = `You are a technical analysis. You task is to analyze given asset based on user strategy. 

## Output
- concise summary of the analysis without heading or title.
- be direct and specific`;

export class AssetAnalyzer {
  constructor(
    private runtime: AgentRuntime,
    private exchange: IExchange,
  ) {}

  async analyze(
    ctx: { abortSignal?: AbortSignal },
    coin: string,
    pairInfo: PairInfo,
  ): Promise<string> {
    const agent = new ToolLoopAgent({
      model: this.runtime.model,
      instructions: cacheableSystem(SYSTEM_PROMPT),
      tools: {
        pineScriptTool: createPineScriptToolForAsset(
          coin,
          this.exchange.fetchCandles.bind(this.exchange),
        ),
      },
    });
    const prompt = `## Asset
Asset: ${coin}
Mark price: ${pairInfo.markPx}
Mid price: ${pairInfo.midPx ? `$${pairInfo.midPx}` : 'N/A'}
Funding rate: ${pairInfo.funding}
Open interest: $${pairInfo.openInterest.toLocaleString()}
Prev day price: $${pairInfo.prevDayPx}
24h volume: $${pairInfo.dayNtlVlm.toLocaleString()}


## Strategy
${this.runtime.config.strategyContent}`;

    const res = await agent.generate({ prompt, abortSignal: ctx.abortSignal });
    return res.text;
  }
}
