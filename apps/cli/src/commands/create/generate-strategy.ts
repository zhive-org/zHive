import { streamText } from 'ai';
import { AIProviderId, buildLanguageModel } from '../../shared/config/ai-providers.js';
import { GAME_OVERVIEW, SCORING_RULES, RANKING_RULES } from '../../shared/rules.js';
import { buildStrategyMarkdown, STRATEGY_PRESETS } from './presets/index.js';

const strategyExamples = STRATEGY_PRESETS.slice(0, 1)
  .map((p) => buildStrategyMarkdown('ExampleAgent', p))
  .join('\n---\n');

export function generateStrategy({
  providerId,
  apiKey,
  agentName,
  strategy,
  feedback,
  draft,
}: {
  providerId: AIProviderId;
  apiKey: string;
  agentName: string;
  strategy: string;
  draft?: string;
  feedback?: string;
}): AsyncIterable<string> {
  const feedbackLine = feedback
    ? `\n\n## User feedback. Adjust the draft based on the feedback:\n"${feedback}"`
    : '';

  const draftLine = draft ? `## Prev Draft\n\n"${draft}"` : '';

  const prompt = `You are a quantitative trader designing a trading strategy that will be used by another LLM to make real trading decision on behalf of the user.

The quality of every trade depends on how clear, specific and self-consistent this strategy is.

## User Input
The creator described the agent's trading strategy as:
"${strategy}"

${draftLine}

${feedbackLine}

## Your Task
Produce a STRATEGY.md with the following sections. Be specific and use concrete numbers wherever possible — avoid vague phrases like "strong trend" or "good setup" without defining them.

## Output format


\`\`\`md
### Philosophy (2-3 sentences)
The core belief about how markets behave and where this strategy's edge comes from.

### Entry Rules
For each valid direction (long and/or short), list the exact conditions that must ALL be true to enter. Use numbers, not adjectives. Example:
- Long entry requires:
  - 1h EMA(20) > EMA(50) > EMA(200)
  - Pullback to EMA(20) with at least one bullish reversal candle
  - RSI(14) between 40 and 60
  - 24h volume above 7-day average

### Exit Rules
- Initial stop loss: where and why (e.g. "1.5 × ATR(14) below entry")
- Take profit: fixed R-multiple, trailing, or condition-based — specify exactly
- Invalidation: what makes the thesis wrong before hitting SL
- Time stop: exit if the trade hasn't worked within X bars/hours

### Position Sizing
How to translate the user's capital rule into a concrete order size, including how to scale down if volatility is elevated.

### Risk Limits
- Max simultaneous positions
- Max loss per day/week before pausing
- Correlation rule (e.g. "don't hold two longs in highly correlated assets")
- Leverage ceiling

### Anti-Patterns (what NOT to do)
Explicit list of behaviors the step-3 LLM must never do, e.g.:
- Never add to a losing position
- Never enter a long if price is below the 200-EMA on the decision timeframe
- Never widen a stop loss after entry
- Never trade during the first 15 minutes of a new daily candle

### Decision Framework
A numbered checklist the analysis LLM walks through in order. This should be the LAST section and should read like a flowchart. Example:
1. Is a position currently open on this asset?
   - Yes → evaluate exit rules first. If any exit triggered, output CLOSE.
   - No → continue.
2. Does the market regime filter pass? If no, output HOLD.
3. Do ALL long entry conditions pass? If yes, output LONG.
4. Do ALL short entry conditions pass? If yes, output SHORT.
5. Otherwise, output HOLD.
\`\`\`

## Example
${strategyExamples}`;

  const model = buildLanguageModel(providerId, apiKey, 'generation');

  const result = streamText({
    model,
    prompt,
    maxOutputTokens: 1200,
  });

  return result.textStream;
}
