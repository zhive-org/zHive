import { describe, expect, it } from 'vitest';
import {
  agentTurnSchema,
  mergeCoveredTopics,
  remainingTopics,
  STRATEGY_TOPICS,
  transcriptToMessages,
} from './strategy-chat-agent';

describe('agentTurnSchema (flat → normalized)', () => {
  it('normalizes a choice question', () => {
    const parsed = agentTurnSchema.parse({
      kind: 'question',
      topic: 'tradingStyle',
      topicsAddressed: ['tradingStyle'],
      prompt: 'Which style?',
      inputType: 'choice',
      choices: [
        { label: 'Trend', value: 'trend', description: null },
        { label: 'Mean-rev', value: 'meanrev', description: null },
      ],
      allowCustom: true,
      allowDefer: true,
      placeholder: null,
    });
    expect(parsed.kind).toBe('question');
    if (parsed.kind === 'question') {
      expect(parsed.input.type).toBe('choice');
      if (parsed.input.type === 'choice') {
        expect(parsed.input.choices).toHaveLength(2);
        expect(parsed.input.allowCustom).toBe(true);
        expect(parsed.input.allowDefer).toBe(true);
      }
    }
  });

  it('normalizes a text question', () => {
    const parsed = agentTurnSchema.parse({
      kind: 'question',
      topic: 'marketRegimeView',
      topicsAddressed: ['marketRegimeView'],
      prompt: 'When does this work?',
      inputType: 'text',
      choices: [],
      allowCustom: false,
      allowDefer: false,
      placeholder: 'In trending markets...',
    });
    expect(parsed.kind).toBe('question');
    if (parsed.kind === 'question' && parsed.input.type === 'text') {
      expect(parsed.input.placeholder).toBe('In trending markets...');
    }
  });

  it('normalizes a done turn', () => {
    const parsed = agentTurnSchema.parse({
      kind: 'done',
      topic: null,
      topicsAddressed: [],
      prompt: '',
      inputType: null,
      choices: [],
      allowCustom: false,
      allowDefer: false,
      placeholder: null,
    });
    expect(parsed.kind).toBe('done');
  });

  it('rejects a choice question with <2 choices', () => {
    expect(() =>
      agentTurnSchema.parse({
        kind: 'question',
        topic: 'tradingStyle',
        topicsAddressed: ['tradingStyle'],
        prompt: 'pick',
        inputType: 'choice',
        choices: [{ label: 'A', value: 'a', description: null }],
        allowCustom: false,
        allowDefer: false,
        placeholder: null,
      }),
    ).toThrow();
  });

  it('rejects an unknown topic', () => {
    expect(() =>
      agentTurnSchema.parse({
        kind: 'done',
        topic: null,
        topicsAddressed: ['notATopic'],
        prompt: '',
        inputType: null,
        choices: [],
        allowCustom: false,
        allowDefer: false,
        placeholder: null,
      }),
    ).toThrow();
  });
});

describe('mergeCoveredTopics', () => {
  it('dedupes and preserves canonical topic order', () => {
    const merged = mergeCoveredTopics(
      ['exitSignal', 'tradingStyle'],
      ['entrySignal', 'tradingStyle'],
    );
    expect(merged).toEqual(['tradingStyle', 'entrySignal', 'exitSignal']);
  });
});

describe('remainingTopics', () => {
  it('returns empty when all covered', () => {
    expect(remainingTopics([...STRATEGY_TOPICS])).toEqual([]);
  });

  it('returns missing topics in canonical order', () => {
    const r = remainingTopics(['tradingStyle', 'entrySignal']);
    expect(r).toContain('exitSignal');
    expect(r).not.toContain('tradingStyle');
  });
});

describe('transcriptToMessages', () => {
  it('puts seed first, then alternating assistant/user pairs', () => {
    const msgs = transcriptToMessages('seed text', [
      { question: 'q1', answer: 'a1', topic: 'tradingStyle' },
      { question: 'q2', answer: 'a2', topic: 'entrySignal' },
    ]);
    expect(msgs).toHaveLength(5);
    expect(msgs[0]).toEqual({ role: 'user', content: 'seed text' });
    expect(msgs[1]).toEqual({ role: 'assistant', content: 'q1' });
    expect(msgs[2]).toEqual({ role: 'user', content: 'a1' });
    expect(msgs[3]).toEqual({ role: 'assistant', content: 'q2' });
    expect(msgs[4]).toEqual({ role: 'user', content: 'a2' });
  });
});
