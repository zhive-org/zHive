import { streamText } from 'ai';
import { buildLanguageModel, type AIProviderId } from '../../shared/config/ai-providers';
import {
  SOUL_PRESETS,
  STRATEGY_PRESETS,
  buildSoulMarkdown,
  buildStrategyMarkdown,
} from './presets/index';

function buildPresetExamples(): string {
  const soulExamples = SOUL_PRESETS.map((p) =>
    buildSoulMarkdown('ExampleAgent', 'example bio text for reference', p, ''),
  ).join('\n---\n');

  const strategyExamples = STRATEGY_PRESETS.map((p) =>
    buildStrategyMarkdown('ExampleAgent', p),
  ).join('\n---\n');

  return `${soulExamples}\n\n===\n\n${strategyExamples}`;
}

const PRESET_EXAMPLES = buildPresetExamples();

export function streamSoul(
  providerId: AIProviderId,
  apiKey: string,
  agentName: string,
  bio: string,
  avatarUrl: string,
  personality: string,
  tone: string,
  voiceStyle: string,
  tradingStyle: string,
  sectors: string[],
  sentiment: string,
  timeframes: string[],
  feedback?: string,
): AsyncIterable<string> {
  const feedbackLine = feedback
    ? `\n\nThe user gave this feedback on the previous draft. Adjust accordingly:\n"${feedback}"`
    : '';

  const sectorsLine = sectors.length > 0 ? sectors.join(', ') : 'all categories';
  const timeframesLine = timeframes.length > 0 ? timeframes.join(', ') : 'all timeframes';

  const identityContext = `Personality: ${personality}
Tone: ${tone}
Voice style: ${voiceStyle}
Trading style: ${tradingStyle}
Sectors: ${sectorsLine}
Sentiment: ${sentiment}
Preferred timeframes: ${timeframesLine}`;

  const prompt = `You are a creative writer designing an AI agent's personality profile for a crypto trading bot called "${agentName}".

The agent's bio is: "${bio}"
${avatarUrl ? `Avatar URL: ${avatarUrl}` : 'No avatar URL provided.'}

Identity traits:
${identityContext}

Context — zHive is a prediction game for AI agents:
- Megathread rounds open for top assets by market cap. Assets include crypto, stocks, and commodities (stocks and commodities are tokenized on-chain but track underlying prices).
- Agents submit a percentage prediction (predicted price change) and a short reasoning.
- Rounds run on fixed UTC schedules across multiple timeframes: 4h, 24h, and 7d. Agents can specialize in one or more timeframes.
- Correct-direction predictions earn honey; wrong-direction predictions earn wax. Wax is a real penalty — it decreases net honey (Net Honey = honey − wax).
- Direction determines honey vs wax; magnitude accuracy affects the amount earned.
- Early predictions are worth dramatically more than late ones (steep time bonus decay).
- Streaks track consecutive correct-direction predictions. Skipping a round carries no penalty and does not break streaks.
- Agents are ranked on a leaderboard by net honey (honey − wax). Simulated PnL and win rate are also tracked as performance metrics.

Generate a SOUL.md file for this agent. The SOUL.md defines who the agent IS — their personality, voice, quirks, opinions, and how they post. The personality should be aware that the agent operates in this prediction game — their voice should reflect how they approach predictions, risk, and competition. Use the identity traits above to shape the personality, tone, and writing style.

CRITICAL: Output ONLY valid markdown matching this exact structure. No extra commentary.

The first line MUST be: # Agent: ${agentName}

Here are reference examples of well-crafted SOUL.md files:
---
${PRESET_EXAMPLES.split('===')[0]}
---

Use these as style/quality references but create something UNIQUE based on the agent's name, bio, and identity traits.${feedbackLine}`;

  const model = buildLanguageModel(providerId, apiKey, 'generation');

  const result = streamText({
    model,
    prompt,
    maxOutputTokens: 1500,
  });

  return result.textStream;
}

export function streamStrategy(
  providerId: AIProviderId,
  apiKey: string,
  agentName: string,
  bio: string,
  personality: string,
  tone: string,
  voiceStyle: string,
  tradingStyle: string,
  sectors: string[],
  sentiment: string,
  timeframes: string[],
  feedback?: string,
): AsyncIterable<string> {
  const feedbackLine = feedback
    ? `\n\nThe user gave this feedback on the previous draft. Adjust accordingly:\n"${feedback}"`
    : '';

  const sectorsLine = sectors.length > 0 ? sectors.join(', ') : 'all categories';
  const timeframesLine = timeframes.length > 0 ? timeframes.join(', ') : 'all timeframes';

  const identityContext = `Personality: ${personality}
Tone: ${tone}
Voice style: ${voiceStyle}
Trading style: ${tradingStyle}
Sectors: ${sectorsLine}
Sentiment: ${sentiment}
Preferred timeframes: ${timeframesLine}`;

  const prompt = `You are designing a prediction strategy profile for a crypto trading bot called "${agentName}".

The agent's bio is: "${bio}"

Identity traits:
${identityContext}

Context — zHive game mechanics that the strategy should account for:
- Agents predict the percentage price change of an asset across multiple timeframes: 4h, 24h, and 7d on fixed UTC schedules. Assets include crypto, stocks, and commodities (stocks/commodities are tokenized on-chain but track underlying prices — analyze the underlying fundamentals).
- Conviction is a number (e.g. 2.5 for +2.5%, -3.0 for -3.0%, 0 for neutral).
- Correct-direction predictions earn honey. Wrong-direction predictions earn wax — a real penalty that decreases net honey (Net Honey = honey − wax).
- Direction determines honey vs wax; magnitude accuracy affects the amount earned.
- Early predictions earn dramatically more honey due to steep time bonus decay — speed matters.
- Consecutive correct-direction predictions build a streak (tracked on profile). Skipping does not break streaks.
- Skipping is a valid strategy — no penalty, no streak break. Knowing when to sit out is a skill.
- Agents are ranked on a leaderboard by net honey (honey − wax). Simulated PnL and win rate are also tracked.
- Agents can specialize in specific timeframes that suit their strategy.

Generate a STRATEGY.md file. The STRATEGY.md defines HOW the agent makes predictions — their method, sector focus, and decision framework. The strategy should reflect the agent's personality and tone, and should address the game mechanics above (e.g. when to skip, how aggressive to be with timing, how to calibrate conviction magnitude).

CRITICAL: Output ONLY valid markdown matching this exact structure. No extra commentary.

The first line MUST be: # Prediction Strategy: ${agentName}

Required sections with EXACT headers:
## Philosophy
## Signal Interpretation
- Method: (must be one of: technical, fundamental, sentiment, onchain, macro)
- Primary indicators: (list key indicators)
(Explain why these timeframes suit the agent's style. Mention that the agent skips signals outside these timeframes.)
## Decision Framework
1. (first step)
2. (second step)
3. (third step)

Here are reference examples of well-crafted STRATEGY.md files:
---
${PRESET_EXAMPLES.split('===')[1] || ''}
---

Create something UNIQUE based on the agent's name, bio, and identity traits.${feedbackLine}`;

  const model = buildLanguageModel(providerId, apiKey, 'generation');

  const result = streamText({
    model,
    prompt,
    maxOutputTokens: 1200,
  });

  return result.textStream;
}
