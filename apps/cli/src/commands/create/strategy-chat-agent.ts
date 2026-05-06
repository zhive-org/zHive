import { generateObject, type ModelMessage } from 'ai';
import { z } from 'zod';
import { AIProviderId, buildLanguageModel } from '../../shared/config/ai-providers.js';

export const STRATEGY_TOPICS = [
  'tradingStyle',
  'assetsAndTimeframe',
  'marketRegimeView',
  'entrySignal',
  'exitSignal',
  'riskAndSizing',
  'experienceAndConstraints',
] as const;

export type StrategyTopic = (typeof STRATEGY_TOPICS)[number];

const TOPIC_DESCRIPTIONS: Record<StrategyTopic, string> = {
  tradingStyle:
    "Trading style/archetype (e.g. trend-following, mean-reversion, momentum, breakout, grid, DCA). Feeds Philosophy.",
  assetsAndTimeframe:
    'Which assets the agent trades and the holding-period timeframe (intraday, swing days, weeks). Feeds Philosophy + Decision Framework.',
  marketRegimeView:
    'When the strategy is supposed to work and when it is not (regime filter / market view). Feeds Philosophy + Decision Framework.',
  entrySignal:
    'Concrete conditions that trigger an entry (which indicators, levels, confirmations). Feeds Entry Rules.',
  exitSignal:
    'Concrete conditions that trigger an exit: take-profit, stop-loss, time-based, trailing. Feeds Exit Rules.',
  riskAndSizing:
    'Risk per trade, max exposure, leverage limits, sizing rules. Feeds Position Sizing + Risk Limits.',
  experienceAndConstraints:
    "User's prior trading experience and any explicit constraints (capital range, drawdown tolerance, things to avoid). Grounds the strategy in realism.",
};

const choiceItemSchema = z.object({
  label: z.string().describe('Short label shown to the user, ≤60 chars.'),
  value: z.string().describe('Value passed back to the agent on selection.'),
  description: z
    .string()
    .nullable()
    .describe('One-line description shown when item is highlighted. null if not needed.'),
});

// Flat schema (no oneOf/discriminatedUnion at any nesting level) for OpenAI strict mode.
// Fields are populated conditionally based on `kind` and `inputType`; validate post-hoc.
const flatAgentTurnSchema = z.object({
  kind: z.enum(['question', 'done']).describe('"question" to ask the user, "done" when finished.'),
  topic: z
    .enum(STRATEGY_TOPICS)
    .nullable()
    .describe('Primary topic of the question. null when kind="done".'),
  topicsAddressed: z
    .array(z.enum(STRATEGY_TOPICS))
    .describe(
      'Topics covered by this turn. For "question": topics that will be addressed once the user answers. For "done": any newly-covered topics (may be empty).',
    ),
  prompt: z.string().describe('The question text when kind="question". Empty string when "done".'),
  inputType: z
    .enum(['choice', 'text'])
    .nullable()
    .describe('"choice" or "text" when kind="question". null when "done".'),
  choices: z
    .array(choiceItemSchema)
    .describe(
      'Between 2 and 6 choices when inputType="choice". Empty array otherwise. Use 3-5 grounded options.',
    ),
  allowCustom: z
    .boolean()
    .describe('Whether user can also type their own answer. Only meaningful for inputType="choice".'),
  allowDefer: z
    .boolean()
    .describe(
      'Whether the user is allowed to defer to you ("pick a sensible default for me"). Default TRUE — only set FALSE when the answer is so personal/preference-driven that you genuinely cannot pick a reasonable default (e.g. risk tolerance, capital range, prior experience). For style/timeframe/indicator/regime questions, ALWAYS set TRUE.',
    ),
  placeholder: z
    .string()
    .nullable()
    .describe('Placeholder for text input. null when not applicable.'),
});

export type FlatAgentTurn = z.infer<typeof flatAgentTurnSchema>;

export interface ChoiceInput {
  type: 'choice';
  choices: { label: string; value: string; description?: string }[];
  allowCustom: boolean;
  allowDefer: boolean;
}
export interface TextInput {
  type: 'text';
  placeholder?: string;
}
export interface QuestionTurn {
  kind: 'question';
  topic: StrategyTopic;
  topicsAddressed: StrategyTopic[];
  prompt: string;
  input: ChoiceInput | TextInput;
}
export interface DoneTurn {
  kind: 'done';
  topicsAddressed: StrategyTopic[];
}
export type AgentTurn = QuestionTurn | DoneTurn;

const agentTurnEnvelope = z.object({
  turn: flatAgentTurnSchema.describe('The next agent turn.'),
});

function normalizeAgentTurn(flat: FlatAgentTurn): AgentTurn {
  if (flat.kind === 'done') {
    return { kind: 'done', topicsAddressed: flat.topicsAddressed };
  }
  if (!flat.topic) throw new Error('question turn missing topic');
  if (flat.inputType === 'choice') {
    if (flat.choices.length < 2) throw new Error('choice question must have ≥2 choices');
    return {
      kind: 'question',
      topic: flat.topic,
      topicsAddressed: flat.topicsAddressed,
      prompt: flat.prompt,
      input: {
        type: 'choice',
        choices: flat.choices.map((c) => ({
          label: c.label,
          value: c.value,
          description: c.description ?? undefined,
        })),
        allowCustom: flat.allowCustom,
        allowDefer: flat.allowDefer,
      },
    };
  }
  return {
    kind: 'question',
    topic: flat.topic,
    topicsAddressed: flat.topicsAddressed,
    prompt: flat.prompt,
    input: { type: 'text', placeholder: flat.placeholder ?? undefined },
  };
}

// Re-exported for tests: validates flat shape, normalizes to AgentTurn.
export const agentTurnSchema = flatAgentTurnSchema.transform(normalizeAgentTurn);

export interface ChatTurn {
  question: string;
  answer: string;
  topic?: StrategyTopic;
}

function buildSystemPrompt(coveredTopics: StrategyTopic[], forceRemaining: StrategyTopic[]): string {
  const remaining = STRATEGY_TOPICS.filter((t) => !coveredTopics.includes(t));
  const topicList = STRATEGY_TOPICS.map((t) => `- **${t}**: ${TOPIC_DESCRIPTIONS[t]}`).join('\n');

  const forceLine =
    forceRemaining.length > 0
      ? `\n\n**You attempted to mark this conversation done, but these topics are still uncovered: ${forceRemaining.join(', ')}. You MUST ask about one of them now — do not emit kind:"done".**`
      : '';

  return `You are a quantitative trading coach interviewing a user to design their algorithmic trading strategy.

Your job: ask short, friendly, ONE-AT-A-TIME questions until you have enough information to generate a high-quality STRATEGY.md. Then emit kind:"done".

## Topics you must cover (each at least once):
${topicList}

## Output contract
Each turn return EITHER:
- kind:"question" — ask one question. Mark it with the primary \`topic\` and any \`topicsAddressed\` it will resolve. Prefer \`input.type:"choice"\` with 3-5 concrete options when the answer space is enumerable; set \`allowCustom:true\` when the user might want a different option. Use \`input.type:"text"\` for genuinely open answers (e.g. describing edge in the user's own words).
- kind:"done" — only when ALL ${STRATEGY_TOPICS.length} topics have been addressed across the conversation.

## Conversation rules
- Read the prior transcript carefully. The first user message is their initial seed prompt — extract everything you can from it before asking.
- Do NOT re-ask information the user already gave.
- Keep questions concrete and decision-shaped, not philosophical. Bad: "What is your edge?". Good: "What's the main signal that tells you to enter — a moving-average cross, a breakout level, RSI, or something else?"
- Choices should be specific and trader-grounded (use real indicators, real timeframes, real % numbers).

## Defer rule (IMPORTANT)
- For EVERY choice question, set \`allowDefer: true\` so the user can ask you to pick a sensible default. The runtime will append a "Pick a sensible default for me" option automatically — DO NOT add it to your \`choices\` list yourself.
- Only set \`allowDefer: false\` when the answer is fundamentally personal and you genuinely cannot pick a reasonable default for the user — e.g. risk-per-trade, capital range, prior trading experience.
- When the user picks defer (you'll see their answer as "(let the agent pick a sensible default)"), use your judgement: pick the most reasonable default for THIS user given the conversation so far, treat that topic as covered, and move on.

## Coverage state
- Already covered: ${coveredTopics.length === 0 ? '(none yet)' : coveredTopics.join(', ')}
- Still to cover: ${remaining.length === 0 ? '(none — you may emit done)' : remaining.join(', ')}${forceLine}`;
}

export interface NextAgentTurnArgs {
  providerId: AIProviderId;
  apiKey: string;
  transcript: ChatTurn[];
  seed: string;
  coveredTopics: StrategyTopic[];
  forceRemaining?: StrategyTopic[];
}

export function transcriptToMessages(seed: string, transcript: ChatTurn[]): ModelMessage[] {
  const messages: ModelMessage[] = [{ role: 'user', content: seed }];
  for (const turn of transcript) {
    messages.push({ role: 'assistant', content: turn.question });
    messages.push({ role: 'user', content: turn.answer });
  }
  return messages;
}

export async function nextAgentTurn({
  providerId,
  apiKey,
  transcript,
  seed,
  coveredTopics,
  forceRemaining = [],
}: NextAgentTurnArgs): Promise<AgentTurn> {
  const model = buildLanguageModel(providerId, apiKey, 'generation');
  const messages = transcriptToMessages(seed, transcript);

  const result = await generateObject({
    model,
    system: buildSystemPrompt(coveredTopics, forceRemaining),
    messages,
    schema: agentTurnEnvelope,
  });

  return normalizeAgentTurn(result.object.turn);
}

export function mergeCoveredTopics(
  current: StrategyTopic[],
  incoming: StrategyTopic[],
): StrategyTopic[] {
  const set = new Set<StrategyTopic>(current);
  for (const t of incoming) set.add(t);
  return STRATEGY_TOPICS.filter((t) => set.has(t));
}

export function remainingTopics(covered: StrategyTopic[]): StrategyTopic[] {
  return STRATEGY_TOPICS.filter((t) => !covered.includes(t));
}
