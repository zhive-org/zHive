import { describe, expect, it } from 'vitest';
import { initial, reduce, type State } from './machine';

const fakeStream: AsyncIterable<string> = {
  [Symbol.asyncIterator]: async function* () {},
};

describe('StrategyStep machine', () => {
  it('starts in preset', () => {
    expect(initial).toEqual({ kind: 'preset' });
  });

  it('preset → review on PRESET_PICKED', () => {
    expect(reduce({ kind: 'preset' }, { type: 'PRESET_PICKED' })).toEqual({
      kind: 'review',
      chatPath: 'preset',
      feedbackCount: 0,
    });
  });

  it('preset → seed on CUSTOM_PICKED', () => {
    expect(reduce({ kind: 'preset' }, { type: 'CUSTOM_PICKED' })).toEqual({ kind: 'seed' });
  });

  it('seed → custom on SEED_SUBMITTED', () => {
    expect(reduce({ kind: 'seed' }, { type: 'SEED_SUBMITTED' })).toEqual({ kind: 'custom' });
  });

  it('seed → preset on BACK', () => {
    expect(reduce({ kind: 'seed' }, { type: 'BACK' })).toEqual({ kind: 'preset' });
  });

  it('custom → streaming on INTERVIEW_DONE', () => {
    const next = reduce({ kind: 'custom' }, { type: 'INTERVIEW_DONE', stream: fakeStream });
    expect(next).toEqual({
      kind: 'streaming',
      chatPath: 'custom',
      feedbackCount: 0,
      stream: fakeStream,
    });
  });

  it('custom → seed on BACK', () => {
    expect(reduce({ kind: 'custom' }, { type: 'BACK' })).toEqual({ kind: 'seed' });
  });

  it('streaming → review on STREAM_COMPLETED', () => {
    const s: State = {
      kind: 'streaming',
      chatPath: 'custom',
      feedbackCount: 2,
      stream: fakeStream,
    };
    expect(reduce(s, { type: 'STREAM_COMPLETED' })).toEqual({
      kind: 'review',
      chatPath: 'custom',
      feedbackCount: 2,
    });
  });

  it('streaming → error on STREAM_FAILED', () => {
    const s: State = {
      kind: 'streaming',
      chatPath: 'preset',
      feedbackCount: 0,
      stream: fakeStream,
    };
    expect(reduce(s, { type: 'STREAM_FAILED', message: 'boom' })).toEqual({
      kind: 'error',
      chatPath: 'preset',
      feedbackCount: 0,
      message: 'boom',
    });
  });

  it('review → streaming on REGEN_REQUESTED, increments feedbackCount', () => {
    const s: State = { kind: 'review', chatPath: 'custom', feedbackCount: 1 };
    expect(reduce(s, { type: 'REGEN_REQUESTED', stream: fakeStream })).toEqual({
      kind: 'streaming',
      chatPath: 'custom',
      feedbackCount: 2,
      stream: fakeStream,
    });
  });

  it('review unchanged on DRAFT_ACCEPTED (wizard advances step)', () => {
    const s: State = { kind: 'review', chatPath: 'preset', feedbackCount: 0 };
    expect(reduce(s, { type: 'DRAFT_ACCEPTED' })).toBe(s);
  });

  it('review BACK → custom when chatPath custom', () => {
    expect(
      reduce({ kind: 'review', chatPath: 'custom', feedbackCount: 0 }, { type: 'BACK' }),
    ).toEqual({ kind: 'custom' });
  });

  it('review BACK → preset when chatPath preset', () => {
    expect(
      reduce({ kind: 'review', chatPath: 'preset', feedbackCount: 0 }, { type: 'BACK' }),
    ).toEqual({ kind: 'preset' });
  });

  it('error → streaming on RETRY (preserves chatPath, feedbackCount)', () => {
    const s: State = {
      kind: 'error',
      chatPath: 'custom',
      feedbackCount: 3,
      message: 'x',
    };
    expect(reduce(s, { type: 'RETRY', stream: fakeStream })).toEqual({
      kind: 'streaming',
      chatPath: 'custom',
      feedbackCount: 3,
      stream: fakeStream,
    });
  });

  it('error BACK → custom when chatPath custom', () => {
    expect(
      reduce(
        { kind: 'error', chatPath: 'custom', feedbackCount: 0, message: '' },
        { type: 'BACK' },
      ),
    ).toEqual({ kind: 'custom' });
  });

  it('error BACK → preset when chatPath preset', () => {
    expect(
      reduce(
        { kind: 'error', chatPath: 'preset', feedbackCount: 0, message: '' },
        { type: 'BACK' },
      ),
    ).toEqual({ kind: 'preset' });
  });

  it('unknown event leaves state unchanged', () => {
    const s: State = { kind: 'seed' };
    // @ts-expect-error - intentionally invalid event
    expect(reduce(s, { type: 'NOPE' })).toBe(s);
  });
});
