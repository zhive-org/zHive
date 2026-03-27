import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '../../../__fixtures__/mock-hive');

vi.mock('./constant', () => ({
  getHiveDir: vi.fn(() => FIXTURES_DIR),
  HIVE_API_URL: 'http://localhost:6969',
}));

vi.mock('./ai-providers', () => ({
  AI_PROVIDERS: [
    { label: 'OpenAI', package: '@ai-sdk/openai', envVar: 'OPENAI_API_KEY' },
    { label: 'Anthropic', package: '@ai-sdk/anthropic', envVar: 'ANTHROPIC_API_KEY' },
  ],
}));

import { findAgentByName, scanAgents } from './agent';

describe('scanAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('discovers all valid agents from fixtures directory', async () => {
    const result = await scanAgents();

    expect(result).toHaveLength(3);
    const names = result.map((a) => a.name).sort();
    expect(names).toEqual(['agent-no-skills', 'empty-agent', 'test-agent']);
  });

  it('loads agent config with correct properties', async () => {
    const result = await scanAgents();

    const testAgent = result.find((a) => a.name === 'test-agent');
    expect(testAgent).toBeDefined();
    expect(testAgent?.bio).toBe('Test agent for CLI testing');
    expect(testAgent?.avatarUrl).toBe('https://example.com/avatar.png');
    expect(testAgent?.agentProfile.sentiment).toBe('bullish');
    expect(testAgent?.agentProfile.timeframes).toEqual(['4h', '24h']);
    expect(testAgent?.agentProfile.sectors).toEqual(['defi', 'gaming']);
  });

  it('loads agent with different sentiment', async () => {
    const result = await scanAgents();

    const bearishAgent = result.find((a) => a.name === 'agent-no-skills');
    expect(bearishAgent).toBeDefined();
    expect(bearishAgent?.agentProfile.sentiment).toBe('bearish');
    expect(bearishAgent?.agentProfile.timeframes).toEqual(['4h']);
    expect(bearishAgent?.agentProfile.sectors).toEqual(['infrastructure']);
  });

  it('handles agent with empty sectors', async () => {
    const result = await scanAgents();

    const emptyAgent = result.find((a) => a.name === 'empty-agent');
    expect(emptyAgent).toBeDefined();
    expect(emptyAgent?.agentProfile.sentiment).toBe('neutral');
    expect(emptyAgent?.agentProfile.sectors).toEqual([]);
  });
});

describe('findAgentByName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when agent name does not match', async () => {
    const result = await findAgentByName('non-existent-agent');

    expect(result).toBeNull();
  });

  it('returns agent when name matches', async () => {
    const result = await findAgentByName('test-agent');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('test-agent');
    expect(result?.dir).toBe(path.join(FIXTURES_DIR, 'agents', 'test-agent'));
  });

  it('finds empty-agent by name', async () => {
    const result = await findAgentByName('empty-agent');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('empty-agent');
    expect(result?.bio).toBe('Empty agent with no skills for testing');
  });

  it('finds agent-no-skills by name', async () => {
    const result = await findAgentByName('agent-no-skills');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('agent-no-skills');
    expect(result?.bio).toBe('Agent without skills directory for testing');
  });
});
