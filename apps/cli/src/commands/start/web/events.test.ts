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
    });
    const { events } = bus.since(0);
    const decision = events[0];
    expect(decision.type).toBe('decision');
    if (decision.type === 'decision') {
      expect(decision.action).toBe('LONG');
      expect(decision.asset).toBe('BTC');
      expect(decision.sizeUsd).toBe(100);
    }
  });
});
