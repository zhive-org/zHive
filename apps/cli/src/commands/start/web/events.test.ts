import { describe, it, expect } from 'vitest';
import { WebEventBus } from './events';

describe('WebEventBus', () => {
  it('assigns monotonic seq starting at 1', () => {
    const bus = new WebEventBus();
    const a = bus.push({ type: 'message', text: 'a' });
    const b = bus.push({ type: 'message', text: 'b' });
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
  });

  it('returns only events with seq > since, plus latest seq', () => {
    const bus = new WebEventBus();
    bus.push({ type: 'message', text: 'a' });
    bus.push({ type: 'message', text: 'b' });
    bus.push({ type: 'message', text: 'c' });

    const { events, latest } = bus.since(1);
    expect(events.map((e) => e.seq)).toEqual([2, 3]);
    expect(latest).toBe(3);
  });

  it('returns empty events when since equals latest', () => {
    const bus = new WebEventBus();
    bus.push({ type: 'message', text: 'a' });
    const { events, latest } = bus.since(1);
    expect(events).toEqual([]);
    expect(latest).toBe(1);
  });

  it('returns latest=0 and empty events when bus is empty', () => {
    const bus = new WebEventBus();
    const { events, latest } = bus.since(0);
    expect(events).toEqual([]);
    expect(latest).toBe(0);
  });

  it('drops oldest events past capacity but keeps seq monotonic', () => {
    const bus = new WebEventBus(3);
    bus.push({ type: 'message', text: '1' });
    bus.push({ type: 'message', text: '2' });
    bus.push({ type: 'message', text: '3' });
    bus.push({ type: 'message', text: '4' });

    const { events, latest } = bus.since(0);
    expect(events.map((e) => e.seq)).toEqual([2, 3, 4]);
    expect(latest).toBe(4);
  });

  it('reports oldestSeq so clients can detect capacity drops', () => {
    const bus = new WebEventBus(3);
    bus.push({ type: 'message', text: '1' });
    bus.push({ type: 'message', text: '2' });
    bus.push({ type: 'message', text: '3' });
    bus.push({ type: 'message', text: '4' });
    bus.push({ type: 'message', text: '5' });

    // Client with stale `since=1` finds oldestSeq=3 — events 2 was evicted,
    // signaling a gap.
    const { events, latest, oldestSeq } = bus.since(1);
    expect(events.map((e) => e.seq)).toEqual([3, 4, 5]);
    expect(latest).toBe(5);
    expect(oldestSeq).toBe(3);
    expect(oldestSeq > 1 + 1).toBe(true);
  });

  it('reports oldestSeq=0 for an empty bus', () => {
    const bus = new WebEventBus();
    const { oldestSeq } = bus.since(0);
    expect(oldestSeq).toBe(0);
  });

  it('starts with generation=1 and bumps on reset', () => {
    const bus = new WebEventBus();
    expect(bus.since(0).generation).toBe(1);
    bus.reset();
    expect(bus.since(0).generation).toBe(2);
    bus.reset();
    expect(bus.since(0).generation).toBe(3);
  });

  it('treats since as 0 when client generation is stale', () => {
    const bus = new WebEventBus();
    bus.push({ type: 'message', text: 'old-1' });
    bus.push({ type: 'message', text: 'old-2' });
    // Client snapshots latest=2, generation=1
    bus.reset();
    bus.push({ type: 'message', text: 'new-1' });
    bus.push({ type: 'message', text: 'new-2' });
    // Without gen param, the stale since=2 would filter out new-1/new-2
    // (their seqs are 1, 2 in the new generation).
    const stale = bus.since(2);
    expect(stale.events).toEqual([]);
    // With gen=1 (stale), server backfills the full new buffer.
    const recovered = bus.since(2, 1);
    expect(recovered.events.map((e) => (e.type === 'message' ? e.text : ''))).toEqual([
      'new-1',
      'new-2',
    ]);
    expect(recovered.generation).toBe(2);
  });

  it('honors since when client generation matches', () => {
    const bus = new WebEventBus();
    bus.push({ type: 'message', text: 'a' });
    bus.push({ type: 'message', text: 'b' });
    bus.push({ type: 'message', text: 'c' });
    const { events, generation } = bus.since(1, 1);
    expect(events.map((e) => e.seq)).toEqual([2, 3]);
    expect(generation).toBe(1);
  });

  it('serializes timestamp as ISO string', () => {
    const bus = new WebEventBus();
    const fixed = new Date('2026-04-29T12:00:00.000Z');
    const event = bus.push({ type: 'message', text: 'hi' }, fixed);
    expect(event.timestamp).toBe('2026-04-29T12:00:00.000Z');
  });

  it('preserves payload fields per discriminant', () => {
    const bus = new WebEventBus();
    bus.push({
      type: 'decision',
      action: 'LONG',
      asset: 'BTC',
      reasoning: 'because',
      sizeUsd: 100,
      priceUsed: 71234.5,
    });
    const { events } = bus.since(0);
    const decision = events[0];
    expect(decision.type).toBe('decision');
    if (decision.type === 'decision') {
      expect(decision.action).toBe('LONG');
      expect(decision.asset).toBe('BTC');
      expect(decision.sizeUsd).toBe(100);
      expect(decision.priceUsed).toBe(71234.5);
    }
  });
});
