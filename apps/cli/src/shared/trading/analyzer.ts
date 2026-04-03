import * as ai from 'ai';
import { MarketService } from './market';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import { AgentRuntime } from '../agent/runtime';
import { AssetContext } from './types';
import { createPineScriptTool } from '../tools/pinescript';

const { ToolLoopAgent } = wrapAISDK(ai);

const SYSTEM_PROMPT = `You are a technical analysis. You task is to analyze given asset based on user strategy. 

## Output
- concise summary of the analysis without heading or title.
- be direct and specific`;

export class AssetAnalyzer {
  constructor(
    private runtime: AgentRuntime,
    private marketService: MarketService,
  ) {}

  async analyze(coin: string, ctx: AssetContext): Promise<string> {
    const agent = new ToolLoopAgent({
      model: this.runtime.model,
      instructions: SYSTEM_PROMPT,
      tools: {
        pineScriptTool: createPineScriptTool(
          this.marketService.fetchCandles.bind(this.marketService),
        ),
      },
    });
    const prompt = `## Asset
Asset: ${coin}
Mark price: ${ctx.markPx}
Mid price: ${ctx.midPx ? `$${ctx.midPx}` : 'N/A'}
Funding rate: ${ctx.funding}
Open interest: $${ctx.openInterest.toLocaleString()}
Prev day price: $${ctx.prevDayPx}
24h volume: $${ctx.dayNtlVlm.toLocaleString()}


## Strategy
${this.runtime.config.strategyContent}`;

    const res = await agent.generate({ prompt });
    return res.text;
  }
}
