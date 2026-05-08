import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const mockGetMe = vi.fn();
const mockGetRank = vi.fn();

vi.mock('../../../shared/config/hive-client', () => ({
  getHiveClient: vi.fn(() => ({
    getMe: mockGetMe,
    trading: { getRank: mockGetRank },
  })),
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

    mockGetMe.mockResolvedValue({ _id: 'agent-id-123' });
    mockGetRank.mockResolvedValue({
      total_pnl_usd: 1234.5,
      roi_pct: 0.1234,
      win_rate_pct: 0.6789,
      max_drawdown_pct: 0.0521,
      total_trades: 42,
    });

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

  it('displays portfolio section with rank stats', async () => {
    const command = createAgentProfileCommand();
    await command.parseAsync(['test-agent'], { from: 'user' });

    expect(mockGetMe).toHaveBeenCalled();
    expect(mockGetRank).toHaveBeenCalledWith('agent-id-123');

    const output = consoleOutput.join('\n');
    expect(output).toContain('Portfolio');
    expect(output).toContain('PNL:');
    expect(output).toContain('+$1234.50');
    expect(output).toContain('ROI:');
    expect(output).toContain('+12.34%');
    expect(output).toContain('WIN RATE:');
    expect(output).toContain('67.89%');
    expect(output).toContain('MAX DD:');
    expect(output).toContain('5.21%');
    expect(output).toContain('TRADES:');
    expect(output).toContain('42');
  });

  it('formats negative PNL and ROI with minus sign', async () => {
    mockGetRank.mockResolvedValue({
      total_pnl_usd: -50.5,
      roi_pct: -0.0725,
      win_rate_pct: 0.4,
      max_drawdown_pct: 0.15,
    });

    const command = createAgentProfileCommand();
    await command.parseAsync(['test-agent'], { from: 'user' });

    const output = consoleOutput.join('\n');
    expect(output).toContain('-$50.50');
    expect(output).toContain('-7.25%');
  });

  it('handles missing roi_pct gracefully', async () => {
    mockGetRank.mockResolvedValue({
      total_pnl_usd: 0,
      roi_pct: null,
      win_rate_pct: 0,
      max_drawdown_pct: 0,
    });

    const command = createAgentProfileCommand();
    await command.parseAsync(['test-agent'], { from: 'user' });

    const output = consoleOutput.join('\n');
    expect(output).toContain('+0.00%');
  });

  it('works with different fixture agents', async () => {
    const command = createAgentProfileCommand();
    await command.parseAsync(['agent-no-skills'], { from: 'user' });

    const output = consoleOutput.join('\n');
    expect(output).toContain('Agent Profile: agent-no-skills');
    expect(output).toContain('Agent without skills directory for testing');
  });
});
