import { HttpRequestError, type InfoClient } from '@nktkas/hyperliquid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HyperliquidService } from './service';

function rateLimitError(headers: Record<string, string> = {}): HttpRequestError {
  const response = new Response('rate limited', { status: 429, headers });
  return new HttpRequestError({ response });
}

function serverError(): HttpRequestError {
  const response = new Response('boom', { status: 500 });
  return new HttpRequestError({ response });
}

function makeService(allMids: ReturnType<typeof vi.fn>): HyperliquidService {
  const fakeInfo = { allMids } as unknown as InfoClient;
  return new HyperliquidService(fakeInfo, { retry: { baseDelayMs: 100, maxDelayMs: 1000 } });
}

describe('HyperliquidService retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns immediately on success', async () => {
    const allMids = vi.fn().mockResolvedValue({ BTC: '50000' });
    const svc = makeService(allMids);

    await expect(svc.allMids()).resolves.toEqual({ BTC: '50000' });
    expect(allMids).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 then succeeds', async () => {
    const allMids = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError())
      .mockRejectedValueOnce(rateLimitError())
      .mockResolvedValue({ BTC: '50000' });
    const svc = makeService(allMids);

    const promise = svc.allMids();
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ BTC: '50000' });
    expect(allMids).toHaveBeenCalledTimes(3);
  });

  it('throws after 5 attempts on persistent 429', async () => {
    const err = rateLimitError();
    const allMids = vi.fn().mockRejectedValue(err);
    const svc = makeService(allMids);

    const promise = svc.allMids();
    promise.catch(() => {}); // prevent unhandled rejection warning
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toBe(err);
    expect(allMids).toHaveBeenCalledTimes(5);
  });

  it('does not retry on non-429 errors', async () => {
    const err = serverError();
    const allMids = vi.fn().mockRejectedValue(err);
    const svc = makeService(allMids);

    await expect(svc.allMids()).rejects.toBe(err);
    expect(allMids).toHaveBeenCalledTimes(1);
  });

  it('does not retry on generic Error', async () => {
    const err = new Error('network down');
    const allMids = vi.fn().mockRejectedValue(err);
    const svc = makeService(allMids);

    await expect(svc.allMids()).rejects.toBe(err);
    expect(allMids).toHaveBeenCalledTimes(1);
  });

  it('honors Retry-After header', async () => {
    const allMids = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError({ 'retry-after': '2' }))
      .mockResolvedValue({ BTC: '1' });
    const svc = makeService(allMids);

    const promise = svc.allMids();

    await vi.advanceTimersByTimeAsync(1999);
    expect(allMids).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2);
    await expect(promise).resolves.toEqual({ BTC: '1' });
    expect(allMids).toHaveBeenCalledTimes(2);
  });
});
