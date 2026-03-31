import { ActiveRound, durationMsToTimeframe } from '@zhive/sdk';
import z from 'zod';
import { GAME_OVERVIEW } from '../rules';
import { humanDuration } from './utils';
import { AgentRuntime } from './runtime';
import _ from 'lodash';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import * as ai from 'ai';

const { generateText, Output } = wrapAISDK(ai);

const schema = z.object({
  rounds: z
    .object({
      roundId: z.string(),
      // For debugging
      projectId: z.string(),
      timeframe: z.string(),
      reason: z.string(),
    })
    .array()
    .describe('Round to participate'),
});

export async function screenMegathreadRounds(
  runtime: AgentRuntime,
  rounds: ActiveRound[],
  options: { limit: number },
): Promise<ActiveRound[]> {
  const { limit } = options;
  const {
    config: {
      strategyContent,
      agentProfile: { sectors, timeframes, sentiment },
    },
  } = runtime;
  const sectorsLine = sectors.length > 0 ? sectors.join(', ') : 'all categories';
  const timeframesLine = timeframes.length > 0 ? timeframes.join(', ') : 'all timeframes';

  if (rounds.length === 0) {
    console.log(`No unpredicted round available`);
    return [];
  }

  const prompt = `You are a megathread scanner. Your task is to pick ${limit} megathread rounds to engage

# What is megathread
${GAME_OVERVIEW}

You are not predicting yet, you ONLY need to pick round that match your preference for now.

Your Focus
---
## Sentiment
- Bias: ${sentiment}
## Sector Focus
- Sectors: ${sectorsLine}
## Timeframe
- Active timeframes: ${timeframesLine}
---

## Your trading strategy
${strategyContent}

## Available Round
${formatRounds(rounds)}

Only engage with projects that match the agent's sectors and expertise as defined in the trading strategy above. If the strategy's sectors include "all" or cover all sectors, always engage — the agent predicts on everything.`;

  const res = await generateText({
    model: runtime.model,
    prompt,
    output: Output.object({ schema }),
  });

  const roundIdToEngage = new Set(res.output.rounds.map((r) => r.roundId));
  const roundToEngage = rounds.filter((r) => roundIdToEngage.has(r.roundId));
  return _.uniqBy(roundToEngage, (round) => round.roundId);
}

function formatRounds(rounds: ActiveRound[]) {
  return rounds
    .map(({ roundId, projectId, durationMs }) => {
      const now = new Date();
      const roundStartMs = Math.floor(now.getTime() / durationMs) * durationMs;
      const timeRemainingMs = Math.max(0, roundStartMs + durationMs - now.getTime());
      const timeRemaining = humanDuration(timeRemainingMs);
      const lines: string[] = [];
      lines.push(`Round: ${roundId}`);
      lines.push(`Project: ${projectId}`);
      lines.push(`Timeframe: ${durationMsToTimeframe(durationMs)}`);
      lines.push(`Remaining Time: ${timeRemaining}`);
      return lines.join('\n');
    })
    .join('\n\n');
}
