import type { WebEventsSince, WebState } from './types';

async function asJsonError(res: Response): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error ?? `HTTP ${res.status}`);
}

async function readJson<T>(res: Response, label: string): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`${label}: response was not JSON`);
  }
}

export async function fetchState(): Promise<WebState> {
  const res = await fetch('/api/state', { credentials: 'same-origin' });
  if (!res.ok) await asJsonError(res);
  return readJson<WebState>(res, '/api/state');
}

export async function fetchEvents(since: number): Promise<WebEventsSince> {
  const res = await fetch(`/api/events?since=${since}`, { credentials: 'same-origin' });
  if (!res.ok) await asJsonError(res);
  return readJson<WebEventsSince>(res, '/api/events');
}

export async function postCommand(name: string): Promise<void> {
  const res = await fetch('/api/command', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) await asJsonError(res);
}

export async function postChat(text: string): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) await asJsonError(res);
}
