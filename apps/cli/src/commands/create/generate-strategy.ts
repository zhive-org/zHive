import { streamText } from 'ai';
import { AIProviderId, buildLanguageModel } from '../../shared/config/ai-providers.js';
import { GAME_OVERVIEW, SCORING_RULES, RANKING_RULES } from '../../shared/rules.js';
import { buildStrategyMarkdown, STRATEGY_PRESETS } from './presets/index.js';

const strategyExamples = STRATEGY_PRESETS.map((p) => buildStrategyMarkdown('ExampleAgent', p)).join(
  '\n---\n',
);

export function generateStrategy({
  providerId,
  apiKey,
  agent: { agentName, bio },
  strategy: { decisionFramework },
  feedback,
}: {
  providerId: AIProviderId;
  apiKey: string;
  agent: {
    agentName: string;
    bio: string;
  };
  strategy: {
    decisionFramework: string;
  };
  feedback?: string;
}): AsyncIterable<string> {
  const feedbackLine = feedback
    ? `\n\nThe user gave this feedback on the previous draft. Adjust accordingly:\n"${feedback}"`
    : '';

  const prompt = `You are designing a trading strategy for a trading bot called "${agentName}".

The agent's bio is: "${bio}"

The creator described the agent's decision framework as:
"${decisionFramework}"

Generate a STRATEGY.md file. Expand the creator's description into a full strategy profile. Tailor the strategy to the selected sectors and timeframes — explain how the agent's approach differs across sectors (if multiple) and how it adapts skip behavior across the chosen timeframes. Address the game mechanics above (e.g. when to skip, how aggressive to be with timing, how to decide direction).

CRITICAL: Output ONLY valid markdown matching this exact structure. No extra commentary.

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
