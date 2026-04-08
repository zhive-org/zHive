import * as ai from 'ai';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import { traceable } from 'langsmith/traceable';
import { z } from 'zod';
import type { AgentRuntime } from '../agent';
import type { HyperliquidMarketService } from './market.js';
import { formatToolError } from '../megathread/utils.js';
import { AssetAnalyzer } from './analyzer.js';
import type { AccountSummary, AssetContext, TradeDecision } from './types.js';
import { loadMemory } from './memory';

const { Output, generateText } = wrapAISDK(ai);

const TradeDecisionSchema = z.object({
  coin: z.string(),
  action: z.enum(['LONG', 'SHORT', 'CLOSE', 'HOLD']),
  reasoning: z.string(),
  leverage: z.number(),
  sizeUsd: z.number().describe('Position size in USD'),
  tp: z.number().describe('Take profit price'),
  sl: z.number().describe('Stop loss price'),
});

const TradeDecisionArraySchema = z.object({
  decisions: z.array(TradeDecisionSchema),
});

export class AssetEvaluator {
  private analyzer: AssetAnalyzer;

  constructor(
    private marketService: HyperliquidMarketService,
    private runtime: AgentRuntime,
  ) {
    this.analyzer = new AssetAnalyzer(runtime, marketService);
  }

  async evaluate(coins: string[], account: AccountSummary): Promise<TradeDecision[]> {
    return traceable(
      async () => {
        const assetEntries: Array<{
          coin: string;
          ctx: AssetContext;
          position?: AccountSummary['positions'][number];
          analysis?: string;
        }> = [];

        const analysisPromises: Promise<string>[] = [];
        for (const coin of coins) {
          const ctx = await this.marketService.getAssetContext(coin);
          if (!ctx) {
            continue;
          }
          analysisPromises.push(
            this.analyzer
              .analyze(coin, ctx)
              .catch((e) => `Analysis failed: ${formatToolError('Technical Analysis', e)}`),
          );

          assetEntries.push({
            coin,
            ctx,
            position: account.positions.find((p) => p.coin === coin),
          });
        }

        const analyses = await Promise.allSettled(analysisPromises);

        for (let i = 0; i < analyses.length; i++) {
          const analysis = analyses[i];
          if (analysis.status === 'fulfilled') {
            assetEntries[i].analysis = analysis.value;
          }
        }

        // If no coins have asset context, return HOLD for all
        if (assetEntries.length === 0) {
          return coins.map((c) => holdDecision(c, 'No asset context available'));
        }

        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = await this.buildUserPrompt(assetEntries, account);

        try {
          const { output } = await generateText({
            model: this.runtime.model,
            system: systemPrompt,
            prompt: userPrompt,
            output: Output.object({ schema: TradeDecisionArraySchema }),
          });

          // Build a map of returned decisions
          const decisionMap = new Map<string, TradeDecision>();
          for (const d of output.decisions) {
            decisionMap.set(d.coin, d);
          }

          // Return decisions for all requested coins, defaulting to HOLD if missing
          return coins.map(
            (coin) =>
              decisionMap.get(coin) ??
              holdDecision(coin, 'No decision returned by LLM — defaulting to HOLD'),
          );
        } catch (err) {
          return coins.map((c) => holdDecision(c, 'Analysis failed — defaulting to HOLD'));
        }
      },
      { name: 'trading-loop', tracingEnabled: process.env.LANGSMITH_TRACING === 'true' },
    )();
  }

  private buildSystemPrompt(): string {
    return `You are a portfolio analyst for Hyperliquid perpetual markets.

You will be given:
    - assets: current asset that are in user's watch list
    - positions: current user position
    - analysis from technical perspective for each asset

You task is to make trading decision for EACH asset: LONG, SHORT, CLOSE, or HOLD.

Trading Strategy:
${this.runtime.config.strategyContent}

Consider cross-asset correlations and portfolio-level risk when making decisions.
Be conservative: prefer HOLD when signals are ambiguous.

Rules
- Make decision based on given analysis.
- Capital preservation is the foundation of successful crypto trading—your primary goal is to protect what you have so you can continue trading and growing.  
- Don't open leveraged position more than 1x.
- Trade only when high-probability setups emerge.
- Avoid overtrading; patience and discipline preserve capital.
- Treat trading like a probability game with positive expectancy over many trades`;
  }

  private async buildUserPrompt(
    assetEntries: Array<{
      coin: string;
      ctx: AssetContext;
      analysis?: string;
      position?: {
        side: string;
        size: number;
        entryPrice: number;
        pnl: number;
        leverage: number;
      };
    }>,
    account: AccountSummary,
  ): Promise<string> {
    const assetLines: string[] = [];
    for (const { coin, ctx, position, analysis } of assetEntries) {
      assetLines.push(`--- ${coin} ---`);
      assetLines.push(`  Mark price: $${ctx.markPx}`);
      assetLines.push(`  Mid price: ${ctx.midPx ? `$${ctx.midPx}` : 'N/A'}`);
      assetLines.push(`  Funding rate: ${ctx.funding}`);
      assetLines.push(`  Open interest: $${ctx.openInterest.toLocaleString()}`);
      assetLines.push(`  Prev day price: $${ctx.prevDayPx}`);
      assetLines.push(`  24h volume: $${ctx.dayNtlVlm.toLocaleString()}`);
      assetLines.push(`  Analysis: ${analysis ?? 'No analysis available'}`);

      if (position) {
        assetLines.push(
          `  Position: ${position.side} size=${position.size} entry=$${position.entryPrice} pnl=$${position.pnl.toFixed(2)} lev=${position.leverage}x`,
        );
      } else {
        assetLines.push('  No current position.');
      }
      assetLines.push('');
    }

    const memory = await loadMemory('trade-decisions.md');

    const availableUsdc = account.spotBalances.find((b) => b.coin === 'USDC')?.total ?? '0';
    const prompt = `Analyze the following ${assetEntries.length} assets and provide a trading decision for each.

Account: value=$${account.accountValue.toFixed(2)}, marginUsed=$${account.marginUsed.toFixed(2)}
Available Trading Balance: value=${availableUsdc}
Current Time: ${new Date().toISOString()}

## Asset
${assetLines.join('\n')}

## Memory

Your past trading decisions.
${memory}`;

    return prompt;
  }
}

function holdDecision(coin: string, reasoning: string): TradeDecision {
  return { coin, action: 'HOLD', sizeUsd: 0, leverage: 1, reasoning };
}
