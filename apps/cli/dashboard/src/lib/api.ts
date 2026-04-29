import type { WebEventsSince, WebState } from './types';

async function asJsonError(res: Response): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error ?? `HTTP ${res.status}`);
}

export async function fetchState(): Promise<WebState> {
  const res = await fetch('/api/state');
  if (!res.ok) await asJsonError(res);
  return res.json();
}

export async function fetchEvents(since: number): Promise<WebEventsSince> {
  const res = await fetch(`/api/events?since=${since}`);
  if (!res.ok) await asJsonError(res);
  return res.json();
}

export async function postCommand(name: string): Promise<void> {
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) await asJsonError(res);
}

export async function postChat(text: string): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) await asJsonError(res);
}
