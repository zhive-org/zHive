import { describe, it, expect } from 'vitest';
import { applyClearChat, dedupeBySeq, eventsReducer } from './useEventStream';
import type { WebEvent } from './types';

function chatEvent(seq: number, text: string): WebEvent {
  return { seq, timestamp: '2026-04-29T00:00:00.000Z', type: 'chat', role: 'user', text };
}
function msgEvent(seq: number, text: string): WebEvent {
  return { seq, timestamp: '2026-04-29T00:00:00.000Z', type: 'message', text };
}
function clearEvent(seq: number): WebEvent {
  return {
    seq,
    timestamp: '2026-04-29T00:00:00.000Z',
    type: 'system',
    kind: 'clear-chat',
  };
}

describe('applyClearChat', () => {
  it('returns events unchanged when no clear-chat is present', () => {
    const events = [msgEvent(1, 'a'), chatEvent(2, 'b')];
    expect(applyClearChat(events)).toEqual(events);
  });

  it('hides chat events whose seq <= the clear cutoff', () => {
    const events = [chatEvent(1, 'old'), clearEvent(2), chatEvent(3, 'new')];
    const out = applyClearChat(events);
    expect(out.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('preserves non-chat events older than the clear cutoff', () => {
    const events = [msgEvent(1, 'history'), clearEvent(2), chatEvent(3, 'fresh')];
    const out = applyClearChat(events);
    expect(out.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('uses the most recent clear when multiple are present', () => {
    const events = [
      chatEvent(1, 'a'),
      clearEvent(2),
      chatEvent(3, 'b'),
      clearEvent(4),
      chatEvent(5, 'c'),
    ];
    const out = applyClearChat(events);
    expect(out.map((e) => e.seq)).toEqual([2, 4, 5]);
  });
});

describe('dedupeBySeq', () => {
  it('drops later occurrences of duplicate seqs', () => {
    const events = [msgEvent(1, 'a'), msgEvent(2, 'b'), msgEvent(2, 'b-dup'), msgEvent(3, 'c')];
    const out = dedupeBySeq(events);
    expect(out.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect((out[1] as Extract<WebEvent, { type: 'message' }>).text).toBe('b');
  });

  it('returns input unchanged when no duplicates', () => {
    const events = [msgEvent(1, 'a'), msgEvent(2, 'b')];
    expect(dedupeBySeq(events)).toEqual(events);
  });
});

describe('eventsReducer', () => {
  it('append: ignores empty input without churn', () => {
    const state = { events: [msgEvent(1, 'a')] };
    const next = eventsReducer(state, { type: 'append', events: [] });
    expect(next).toBe(state);
  });

  it('append: dedupes events that already exist', () => {
    const state = { events: [msgEvent(1, 'a'), msgEvent(2, 'b')] };
    const next = eventsReducer(state, {
      type: 'append',
      events: [msgEvent(2, 'b'), msgEvent(3, 'c')],
    });
    expect(next.events.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('append: applies clear-chat from a freshly added system event', () => {
    const state = { events: [chatEvent(1, 'old')] };
    const next = eventsReducer(state, {
      type: 'append',
      events: [clearEvent(2), chatEvent(3, 'fresh')],
    });
    expect(next.events.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('reset: replaces state entirely with the new events', () => {
    const state = { events: [msgEvent(1, 'old')] };
    const next = eventsReducer(state, {
      type: 'reset',
      events: [msgEvent(50, 'fresh-1'), msgEvent(51, 'fresh-2')],
    });
    expect(next.events.map((e) => e.seq)).toEqual([50, 51]);
  });

  it('append: caps merged events at MAX_EVENTS keeping the newest', () => {
    const initial: WebEvent[] = [];
    for (let i = 1; i <= 600; i++) initial.push(msgEvent(i, `m${i}`));
    const next = eventsReducer({ events: [] }, { type: 'append', events: initial });
    expect(next.events.length).toBe(500);
    expect(next.events[0].seq).toBe(101);
    expect(next.events[next.events.length - 1].seq).toBe(600);
  });
});
