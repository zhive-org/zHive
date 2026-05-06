import { streamText } from 'ai';
import { AIProviderId, buildLanguageModel } from '../../shared/config/ai-providers.js';
import { buildStrategyMarkdown, STRATEGY_PRESETS } from './presets/index.js';
import type { ChatTurn } from './strategy-chat-agent.js';

const strategyExamples = STRATEGY_PRESETS.slice(0, 1)
  .map((p) => buildStrategyMarkdown('ExampleAgent', p))
  .join('\n---\n');

function buildPrompt({
  userInputBlock,
  draft,
  feedback,
}: {
  userInputBlock: string;
  draft?: string;
  feedback?: string;
}): string {
  const feedbackLine = feedback
    ? `\n\n## User feedback. Adjust the draft based on the feedback:\n"${feedback}"`
    : '';

  const draftLine = draft ? `## Prev Draft\n\n"${draft}"` : '';

  return `You are a quantitative trader designing a trading strategy that will be used by trading agent to make real trading decision on behalf of the user.

The trading agent will be given
- Position
  - side: LONG or SHORT
  - size: in base currency unit
  - entry price 
  - pnl
  - leverage
- Account
  - value
  - margin used
  - available trading balance
- Asset
  - price
  - historical price ( fetch on demand )
  - mark price
  - mid price
  - open interest
  - 24h volume
Strategy should only  

Then it will use STRATEGY.md to decide the next action.

The quality of every trade depends on how clear, specific and self-consistent this strategy is.

${userInputBlock}

${draftLine}

${feedbackLine}

## Your Task
Produce a STRATEGY.md with the following sections. Be specific and use concrete numbers wherever possible — avoid vague phrases like "strong trend" or "good setup" without defining them.
Make sure that strategy can be evaluated with available data.

## Output format
\`\`\`md
### Philosophy
The core belief about how markets behave and where this strategy's edge comes from. (2-3 sentences)

### Entry Rules
For each valid direction (long and/or short), list the exact conditions to enter

### Exit Rules
For each valid direction (long and/or short), list the exact conditions to exit

### Position Sizing
How to translate the user's capital rule into a concrete order size
 
### Risk Limits
- Guardrails to prevent oversized positions
- Maximum exposure the bot is allowed to take on at any time.

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

### Example output
${strategyExamples}`;
}

function streamPrompt(
  providerId: AIProviderId,
  apiKey: string,
  prompt: string,
): AsyncIterable<string> {
  const model = buildLanguageModel(providerId, apiKey, 'generation');
  const result = streamText({
    model,
    prompt,
    maxOutputTokens: 1200,
  });
  return result.textStream;
}

export function generateStrategy({
  providerId,
  apiKey,
  agentName: _agentName,
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
  const userInputBlock = `## User Input
The creator described the agent's trading strategy as:
"${strategy}"`;

  return streamPrompt(providerId, apiKey, buildPrompt({ userInputBlock, draft, feedback }));
}

function serializeTranscript(seed: string, transcript: ChatTurn[]): string {
  const lines = [`User's initial intent: "${seed}"`, '', '### Q&A:'];
  for (const turn of transcript) {
    lines.push(`Q: ${turn.question}`);
    lines.push(`A: ${turn.answer}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function generateStrategyFromTranscript({
  providerId,
  apiKey,
  seed,
  transcript,
  feedback,
  draft,
  assets = [],
}: {
  providerId: AIProviderId;
  apiKey: string;
  seed: string;
  transcript: ChatTurn[];
  draft?: string;
  feedback?: string;
  assets?: string[];
}): AsyncIterable<string> {
  const assetsLine =
    assets.length > 0
      ? `The user has already selected these assets to trade in the wizard: ${assets.join(', ')}. Tailor the strategy to these specific assets where it matters; otherwise stay generic.\n\n`
      : '';

  const userInputBlock = `## User Input
${assetsLine}The creator and an interview agent had the following conversation about the trading strategy. Use ALL of it to design the strategy:

${serializeTranscript(seed, transcript)}`;

  return streamPrompt(providerId, apiKey, buildPrompt({ userInputBlock, draft, feedback }));
}
