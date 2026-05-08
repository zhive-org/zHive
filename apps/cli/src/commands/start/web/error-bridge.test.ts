import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { attachErrorBridge } from './error-bridge';
import { WebEventBus } from './events';

describe('attachErrorBridge', () => {
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;

  beforeEach(() => {
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    vi.restoreAllMocks();
  });

  it('routes console.error to the event bus AND keeps the original behavior', () => {
    const bus = new WebEventBus();
    const handle = attachErrorBridge(bus);
    try {
      console.error('boom');
      const { events } = bus.since(0);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: 'error', errorMessage: 'boom' });
    } finally {
      handle.detach();
    }
  });

  it('routes console.warn to the event bus', () => {
    const bus = new WebEventBus();
    const handle = attachErrorBridge(bus);
    try {
      console.warn('careful');
      const { events } = bus.since(0);
      expect(events.some((e) => e.type === 'error' && e.errorMessage === 'careful')).toBe(true);
    } finally {
      handle.detach();
    }
  });

  it('formats Error instances with stack traces', () => {
    const bus = new WebEventBus();
    const handle = attachErrorBridge(bus);
    try {
      const err = new Error('detailed');
      console.error(err);
      const { events } = bus.since(0);
      expect(events).toHaveLength(1);
      const evt = events[0];
      if (evt.type !== 'error') throw new Error('expected error event');
      expect(evt.errorMessage).toContain('detailed');
    } finally {
      handle.detach();
    }
  });

  it('detach() restores the original console functions', () => {
    const bus = new WebEventBus();
    const handle = attachErrorBridge(bus);
    handle.detach();
    console.error('post-detach');
    const { events } = bus.since(0);
    expect(events).toHaveLength(0);
  });

  it('handles unhandledRejection events', () => {
    const bus = new WebEventBus();
    const handle = attachErrorBridge(bus);
    try {
      // Manually emit. process.emit returns boolean for arbitrary events.
      (process as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
        'unhandledRejection',
        new Error('unhandled'),
      );
      const { events } = bus.since(0);
      expect(events.some((e) => e.type === 'error' && e.errorMessage.includes('unhandled'))).toBe(
        true,
      );
    } finally {
      handle.detach();
    }
  });

  it('truncates very long messages', () => {
    const bus = new WebEventBus();
    const handle = attachErrorBridge(bus);
    try {
      console.error('x'.repeat(5000));
      const { events } = bus.since(0);
      expect(events).toHaveLength(1);
      const evt = events[0];
      if (evt.type !== 'error') throw new Error('expected error event');
      expect(evt.errorMessage.length).toBeLessThanOrEqual(1024 + '… [truncated]'.length);
      expect(evt.errorMessage.endsWith('[truncated]')).toBe(true);
    } finally {
      handle.detach();
    }
  });
});
