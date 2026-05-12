import type {
  AgentConfigUpdate,
  AgentPortfolio,
  AgentProfile,
  ApiState,
  AvailableTickers,
  ClosedTradesPage,
  ClosedTradesTimeframe,
  CredentialsUpdate,
  PickerAgentsStats,
  PortfolioRange,
  PositionsPage,
  WebEventsSince,
} from './types';

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

export async function fetchApiState(): Promise<ApiState> {
  const res = await fetch('/api/state', { credentials: 'same-origin' });
  if (!res.ok) await asJsonError(res);
  return readJson<ApiState>(res, '/api/state');
}

export async function fetchAgentProfile(): Promise<AgentProfile> {
  const res = await fetch('/api/agent/profile', { credentials: 'same-origin' });
  if (!res.ok) await asJsonError(res);
  return readJson<AgentProfile>(res, '/api/agent/profile');
}

export async function fetchAgentsStats(): Promise<PickerAgentsStats> {
  const res = await fetch('/api/agents/stats', { credentials: 'same-origin' });
  if (!res.ok) await asJsonError(res);
  return readJson<PickerAgentsStats>(res, '/api/agents/stats');
}

export async function fetchAgentPortfolio(range: PortfolioRange): Promise<AgentPortfolio> {
  const qs = new URLSearchParams({ range });
  const res = await fetch(`/api/agent/portfolio?${qs}`, { credentials: 'same-origin' });
  if (!res.ok) await asJsonError(res);
  return readJson<AgentPortfolio>(res, '/api/agent/portfolio');
}

export async function fetchAgentPositions(): Promise<PositionsPage> {
  const res = await fetch('/api/agent/positions', { credentials: 'same-origin' });
  if (!res.ok) await asJsonError(res);
  return readJson<PositionsPage>(res, '/api/agent/positions');
}

export async function fetchAvailableTickers(): Promise<AvailableTickers> {
  const res = await fetch('/api/tickers', { credentials: 'same-origin' });
  if (!res.ok) await asJsonError(res);
  return readJson<AvailableTickers>(res, '/api/tickers');
}

export async function fetchAgentClosedTrades(
  timeframe: ClosedTradesTimeframe,
): Promise<ClosedTradesPage> {
  const qs = new URLSearchParams({ timeframe });
  const res = await fetch(`/api/agent/closed-trades?${qs}`, { credentials: 'same-origin' });
  if (!res.ok) await asJsonError(res);
  return readJson<ClosedTradesPage>(res, '/api/agent/closed-trades');
}

export async function selectAgent(name: string): Promise<void> {
  const res = await fetch('/api/agents/select', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  // 202 Accepted is the normal response — server is initializing async.
  if (!res.ok && res.status !== 202) await asJsonError(res);
}

export async function exitAgent(): Promise<void> {
  const res = await fetch('/api/agents/exit', {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!res.ok) await asJsonError(res);
}

async function putJson(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await asJsonError(res);
}

export async function updateAgentConfig(partial: AgentConfigUpdate): Promise<void> {
  await putJson('/api/agent/config', partial);
}

export async function updateAgentSoul(content: string): Promise<void> {
  await putJson('/api/agent/soul', { content });
}

export async function updateAgentStrategy(content: string): Promise<void> {
  await putJson('/api/agent/strategy', { content });
}

export async function updateAgentCredentials(args: CredentialsUpdate): Promise<void> {
  await putJson('/api/agent/credentials', args);
}

export async function fetchEvents(since: number, generation?: number): Promise<WebEventsSince> {
  const params = new URLSearchParams({ since: String(since) });
  if (generation !== undefined) params.set('gen', String(generation));
  const res = await fetch(`/api/events?${params.toString()}`, { credentials: 'same-origin' });
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
