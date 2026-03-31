import { streamText } from 'ai';
import { AIProviderId, buildLanguageModel } from '../../shared/config/ai-providers.js';
import { buildSoulMarkdown, SOUL_PRESETS } from './presets/index.js';

const soulExamples = SOUL_PRESETS.map((p) =>
  buildSoulMarkdown('ExampleAgent', 'example bio text for reference', p, ''),
).join('\n---\n');

export function generateSoul({
  providerId,
  apiKey,
  agent: { agentName, bio },
  initialPrompt,
  feedback,
}: {
  providerId: AIProviderId;
  agent: {
    agentName: string;
    bio: string;
  };
  apiKey: string;
  initialPrompt: string;
  feedback?: string;
}): AsyncIterable<string> {
  const feedbackLine = feedback
    ? `\n\nThe user gave this feedback on the previous draft. Adjust accordingly:\n"${feedback}"`
    : '';

  const prompt = `You are a creative writer designing an AI agent's personality profile for a crypto trading bot called "${agentName}".

The agent's bio is: "${bio}"

The creator described the agent's personality and voice as:
"${initialPrompt}"

Context — zHive is a prediction game for AI agents:
- Megathread rounds open for top assets by market cap. Assets include crypto, stocks, and commodities (stocks and commodities are tokenized on-chain but track underlying prices).
- Agents submit a percentage prediction (predicted price change) and a short reasoning.
- Rounds run on fixed UTC schedules across multiple timeframes: 4h, 24h, and 7d. Agents can specialize in one or more timeframes.
- Correct-direction predictions earn honey; wrong-direction predictions earn wax. Wax is a real penalty — it decreases net honey (Net Honey = honey − wax).
- Direction determines honey vs wax; magnitude accuracy affects the amount earned.
- Early predictions are worth dramatically more than late ones (steep time bonus decay).
- Streaks track consecutive correct-direction predictions. Skipping a round carries no penalty and does not break streaks.
- Agents are ranked on a leaderboard by net honey (honey − wax). Simulated PnL and win rate are also tracked as performance metrics.

Generate a SOUL.md file for this agent. Expand the creator's description into a full personality profile. The personality should be aware that the agent operates in this prediction game — their voice should reflect how they approach predictions, risk, and competition.

CRITICAL: Output ONLY valid markdown matching this exact structure. No extra commentary.

The first line MUST be: # Agent: ${agentName}

Required sections with EXACT headers:

## Personality
A short description of the agent's core character — their temperament, attitude, and how they carry themselves. Derive this from the creator's description.

## Voice
How the agent writes and communicates. Include tone (e.g. confident, dry, unhinged) and style (e.g. short punchy takes, data-heavy, CT slang). This shapes every post the agent makes.

## Quirks
Specific behavioral habits that make the agent feel unique and human — recurring tics, catchphrases, or mannerisms in how they write. These are the small details that give the personality texture.

## Opinions
Strong beliefs the agent holds about markets, trading, or the crypto space. These come through in their posts and predictions — they're opinionated, not neutral.

## Pet Peeves
Things that specifically annoy this agent and trigger a reaction. These define what the agent pushes back against and give it an edge.

## Example Posts
3-4 sample posts showing exactly how this agent would write in a prediction context. These should demonstrate the voice, quirks, and opinions in action.

Here are reference examples of well-crafted SOUL.md files:
---
${soulExamples}
---

Use these as style/quality references but create something UNIQUE based on the agent's name, bio, and the creator's description.${feedbackLine}`;

  const model = buildLanguageModel(providerId, apiKey, 'generation');

  const result = streamText({
    model,
    prompt,
    maxOutputTokens: 1500,
  });

  return result.textStream;
}
