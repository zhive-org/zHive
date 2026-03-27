import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '../../../../__fixtures__/mock-hive');

vi.mock('../../../shared/config/constant', () => ({
  getHiveDir: vi.fn(() => FIXTURES_DIR),
  HIVE_API_URL: 'http://localhost:6969',
}));

vi.mock('../../../shared/config/ai-providers', () => ({
  AI_PROVIDERS: [{ label: 'OpenAI', package: '@ai-sdk/openai', envVar: 'OPENAI_API_KEY' }],
}));

vi.mock('../../shared/theme', () => ({
  styled: {
    red: (text: string) => text,
    gray: (text: string) => text,
    honey: (text: string) => text,
    honeyBold: (text: string) => text,
    wax: (text: string) => text,
    green: (text: string) => text,
  },
  symbols: {
    cross: '✗',
    check: '✓',
    hive: '⬡',
  },
}));

import { createAgentProfileCommand } from './profile';

describe('createAgentProfileCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let consoleOutput: string[];
  let consoleErrorOutput: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    consoleOutput = [];
    consoleErrorOutput = [];

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      consoleOutput.push(args.join(' '));
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      consoleErrorOutput.push(args.join(' '));
    });
    processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null | undefined) => {
        throw new Error(`process.exit(${code})`);
      }) as unknown as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('shows error when agent not found and lists available agents', async () => {
    const command = createAgentProfileCommand();

    await expect(command.parseAsync(['non-existent'], { from: 'user' })).rejects.toThrow(
      'process.exit(1)',
    );

    expect(consoleErrorOutput.join('\n')).toContain('Agent "non-existent" not found');
    expect(consoleErrorOutput.join('\n')).toContain('Available agents:');
    expect(consoleErrorOutput.join('\n')).toContain('test-agent');
    expect(consoleErrorOutput.join('\n')).toContain('empty-agent');
    expect(consoleErrorOutput.join('\n')).toContain('agent-no-skills');
  });

  it('shows error when credentials are missing', async () => {
    const command = createAgentProfileCommand();

    await expect(command.parseAsync(['no-cred'], { from: 'user' })).rejects.toThrow(
      'process.exit(1)',
    );

    expect(consoleErrorOutput.join('\n')).toContain('Agent "no-cred" not found');
  });

  it('displays profile from local config', async () => {
    const command = createAgentProfileCommand();
    await command.parseAsync(['test-agent'], { from: 'user' });

    const output = consoleOutput.join('\n');
    expect(output).toContain('Agent Profile: test-agent');
    expect(output).toContain('Name:');
    expect(output).toContain('test-agent');
    expect(output).toContain('Bio:');
    expect(output).toContain('Test agent for CLI testing');
    expect(output).toContain('Avatar:');
    expect(output).toContain('https://example.com/avatar.png');
  });

  it('displays profile settings section', async () => {
    const command = createAgentProfileCommand();
    await command.parseAsync(['test-agent'], { from: 'user' });

    const output = consoleOutput.join('\n');
    expect(output).toContain('Profile Settings');
    expect(output).toContain('Sentiment:');
    expect(output).toContain('bullish');
    expect(output).toContain('Timeframes:');
    expect(output).toContain('4h, 24h');
    expect(output).toContain('Sectors:');
    expect(output).toContain('defi, gaming');
  });

  it('handles agent with empty sectors', async () => {
    const command = createAgentProfileCommand();
    await command.parseAsync(['empty-agent'], { from: 'user' });

    const output = consoleOutput.join('\n');
    expect(output).toContain('Agent Profile: empty-agent');
    expect(output).toContain('Sentiment:');
    expect(output).toContain('neutral');
    expect(output).toContain('Sectors:');
    // Empty sectors should show dash
    const sectorsLine = consoleOutput.find((line) => line.includes('Sectors:'));
    expect(sectorsLine).toContain('-');
  });

  it('works with different fixture agents', async () => {
    const command = createAgentProfileCommand();
    await command.parseAsync(['agent-no-skills'], { from: 'user' });

    const output = consoleOutput.join('\n');
    expect(output).toContain('Agent Profile: agent-no-skills');
    expect(output).toContain('bearish');
    expect(output).toContain('infrastructure');
  });
});
