import { streamText } from 'ai';
import { AIProviderId, buildLanguageModel } from '../../shared/config/ai-providers.js';
import { buildStrategyMarkdown, STRATEGY_PRESETS } from './presets/index.js';

const strategyExamples = STRATEGY_PRESETS.map((p) => buildStrategyMarkdown('ExampleAgent', p)).join(
  '\n---\n',
);

export function generateStrategy({
  providerId,
  apiKey,
  agent: { agentName, bio },
  strategy: { sectors, timeframes, decisionFramework },
  feedback,
}: {
  providerId: AIProviderId;
  apiKey: string;
  agent: {
    agentName: string;
    bio: string;
  };
  strategy: {
    sectors: string[];
    timeframes: string[];
    decisionFramework: string;
  };
  feedback?: string;
}): AsyncIterable<string> {
  const feedbackLine = feedback
    ? `\n\nThe user gave this feedback on the previous draft. Adjust accordingly:\n"${feedback}"`
    : '';

  const prompt = `You are designing a prediction strategy profile for a crypto trading bot called "${agentName}".

The agent's bio is: "${bio}"

The creator described the agent's decision framework as:
"${decisionFramework}"

The creator selected these sectors: ${sectors.join(', ')}
The creator selected these prediction timeframes: ${timeframes.join(', ')}

Context — zHive game mechanics that the strategy should account for:
- Agents predict the percentage price change of an asset across multiple timeframes (${timeframes.join(', ')}) on fixed UTC schedules. Assets span the sectors the creator chose (${sectors.join(', ')}). Stocks and commodities are tokenized on-chain but track underlying prices — analyze the underlying fundamentals.
- Conviction is a number (e.g. 2.5 for +2.5%, -3.0 for -3.0%, 0 for neutral).
- Correct-direction predictions earn honey. Wrong-direction predictions earn wax — a real penalty that decreases net honey (Net Honey = honey − wax).
- Direction determines honey vs wax; magnitude accuracy affects the amount earned.
- Early predictions earn dramatically more honey due to steep time bonus decay — speed matters.
- Consecutive correct-direction predictions build a streak (tracked on profile). Skipping does not break streaks.
- Skipping is a valid strategy — no penalty, no streak break. Knowing when to sit out is a skill.
- Agents are ranked on a leaderboard by net honey (honey − wax). Simulated PnL and win rate are also tracked.
- Agents can specialize in specific timeframes that suit their strategy.

Generate a STRATEGY.md file. Expand the creator's description into a full strategy profile. Tailor the strategy to the selected sectors and timeframes — explain how the agent's approach differs across sectors (if multiple) and how it adapts conviction/skip behavior across the chosen timeframes. Address the game mechanics above (e.g. when to skip, how aggressive to be with timing, how to calibrate conviction magnitude).

CRITICAL: Output ONLY valid markdown matching this exact structure. No extra commentary.

The first line MUST be: # Prediction Strategy: ${agentName}

Required sections with EXACT headers:

## Philosophy
A 1-2 sentence thesis statement that captures the agent's core belief about how markets work and how to profit from them. This is the "why" behind the strategy — what the agent fundamentally believes drives prices. Derive this from the creator's description.

## Decision Framework
The agent's concrete process for going from raw signal to final prediction. Describe what signals the agent looks for, how it filters or confirms them, how it sizes conviction, and when it decides to skip. This should be actionable and specific, not vague platitudes. The format is flexible — use numbered steps, bullet points, or prose, whatever best fits the strategy.

Here are reference examples of well-crafted STRATEGY.md files:
---
${strategyExamples}
---

Create something UNIQUE based on the agent's name, bio, and the creator's decision framework.${feedbackLine}`;

  const model = buildLanguageModel(providerId, apiKey, 'generation');

  const result = streamText({
    model,
    prompt,
    maxOutputTokens: 1200,
  });

  return result.textStream;
}
