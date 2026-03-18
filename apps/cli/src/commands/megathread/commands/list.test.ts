import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import type { ActiveRound } from '@zhive/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '../../../../__fixtures__/mock-hive');

vi.mock('../../../shared/config/constant.js', () => ({
  getHiveDir: vi.fn(() => FIXTURES_DIR),
  HIVE_API_URL: 'http://localhost:6969',
}));

vi.mock('../../../shared/config/ai-providers.js', () => ({
  AI_PROVIDERS: [{ label: 'OpenAI', package: '@ai-sdk/openai', envVar: 'OPENAI_API_KEY' }],
}));

vi.mock('@zhive/sdk', async () => {
  const actual = await vi.importActual('@zhive/sdk');
  return {
    ...actual,
    HiveClient: vi.fn().mockImplementation(() => ({
      getUnpredictedRounds: vi.fn(),
    })),
    TIMEFRAME_DURATION_MS: {
      D7: 604800000,
      H24: 86400000,
      H4: 14400000,
    },
    Timeframe: {
      D7: 'D7',
      H24: 'H24',
      H4: 'H4',
    },
  };
});

import { HiveClient } from '@zhive/sdk';
import { createMegathreadListCommand } from './list.js';

const MockHiveClient = HiveClient as Mock;

function createMockActiveRound(overrides: Partial<ActiveRound> = {}): ActiveRound {
  return {
    roundId: 'round-123',
    projectId: 'bitcoin',
    durationMs: 14400000,
    snapTimeMs: Date.now(),
    priceAtStart: null,
    ...overrides,
  };
}

describe('createMegathreadListCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let consoleOutput: string[];
  let consoleErrorOutput: string[];
  let mockGetUnpredictedRounds: Mock;

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

    mockGetUnpredictedRounds = vi.fn();
    MockHiveClient.mockImplementation(() => ({
      getUnpredictedRounds: mockGetUnpredictedRounds,
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('timeframe validation', () => {
    it('shows error for invalid timeframe value', async () => {
      const command = createMegathreadListCommand();

      await expect(
        command.parseAsync(['--agent', 'test-agent', '--timeframe', '2h'], { from: 'user' }),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.length).toBeGreaterThan(0);
    });

    it('shows error for multiple invalid timeframes', async () => {
      const command = createMegathreadListCommand();

      await expect(
        command.parseAsync(['--agent', 'test-agent', '--timeframe', '2h,5h'], { from: 'user' }),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.length).toBeGreaterThan(0);
    });

    it('accepts valid timeframe values', async () => {
      mockGetUnpredictedRounds.mockResolvedValue([]);

      const command = createMegathreadListCommand();
      await command.parseAsync(['--agent', 'test-agent', '--timeframe', '4h,24h'], {
        from: 'user',
      });

      expect(mockGetUnpredictedRounds).toHaveBeenCalledWith(['4h', '24h']);
    });

    it('accepts single valid timeframe', async () => {
      mockGetUnpredictedRounds.mockResolvedValue([]);

      const command = createMegathreadListCommand();
      await command.parseAsync(['--agent', 'test-agent', '--timeframe', '7d'], { from: 'user' });

      expect(mockGetUnpredictedRounds).toHaveBeenCalledWith(['7d']);
    });

    it('passes undefined when no timeframe filter specified', async () => {
      mockGetUnpredictedRounds.mockResolvedValue([]);

      const command = createMegathreadListCommand();
      await command.parseAsync(['--agent', 'test-agent'], { from: 'user' });

      expect(mockGetUnpredictedRounds).toHaveBeenCalledWith(undefined);
    });
  });

  describe('agent validation', () => {
    it('shows error when agent not found and lists available agents', async () => {
      const command = createMegathreadListCommand();

      await expect(
        command.parseAsync(['--agent', 'non-existent'], { from: 'user' }),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.join('\n')).toContain('Agent "non-existent" not found');
      expect(consoleErrorOutput.join('\n')).toContain('Available agents:');
      expect(consoleErrorOutput.join('\n')).toContain('test-agent');
      expect(consoleErrorOutput.join('\n')).toContain('empty-agent');
      expect(consoleErrorOutput.join('\n')).toContain('agent-no-skills');
    });
  });

  describe('credentials validation', () => {
    it('shows error when credentials are missing', async () => {
      const command = createMegathreadListCommand();

      await expect(
        command.parseAsync(['--agent', 'no-cred-agent'], { from: 'user' }),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.join('\n')).toContain('Agent "no-cred-agent" not found');
    });
  });

  describe('rounds display', () => {
    it('shows message when no unpredicted rounds available', async () => {
      mockGetUnpredictedRounds.mockResolvedValue([]);

      const command = createMegathreadListCommand();
      await command.parseAsync(['--agent', 'test-agent'], { from: 'user' });

      const output = consoleOutput.join('\n');
      expect(output).toContain('Unpredicted Rounds for test-agent');
      expect(output).toContain('No unpredicted rounds available');
    });

    it('displays rounds in table format', async () => {
      const mockRounds: ActiveRound[] = [
        createMockActiveRound({ roundId: 'round-1', projectId: 'bitcoin', durationMs: 14400000 }),
        createMockActiveRound({ roundId: 'round-2', projectId: 'ethereum', durationMs: 14400000 }),
      ];

      mockGetUnpredictedRounds.mockResolvedValue(mockRounds);

      const command = createMegathreadListCommand();
      await command.parseAsync(['--agent', 'test-agent'], { from: 'user' });

      const output = consoleOutput.join('\n');
      expect(output).toContain('Unpredicted Rounds for test-agent');
      expect(output).toContain('Round ID');
      expect(output).toContain('Token');
      expect(output).toContain('Timeframe');
      expect(output).toContain('round-1');
      expect(output).toContain('bitcoin');
      expect(output).toContain('round-2');
      expect(output).toContain('ethereum');
      expect(output).toContain('Total: 2 round(s)');
    });

    it('shows fallback duration when timeframe not recognized', async () => {
      const mockRounds: ActiveRound[] = [
        createMockActiveRound({ roundId: 'round-1', projectId: 'bitcoin', durationMs: 7200000 }),
      ];

      mockGetUnpredictedRounds.mockResolvedValue(mockRounds);

      const command = createMegathreadListCommand();
      await command.parseAsync(['--agent', 'test-agent'], { from: 'user' });

      const output = consoleOutput.join('\n');
      expect(output).toContain('7200000ms');
    });
  });

  describe('API error handling', () => {
    it('shows error when API call fails', async () => {
      mockGetUnpredictedRounds.mockRejectedValue(new Error('Network error'));

      const command = createMegathreadListCommand();

      await expect(command.parseAsync(['--agent', 'test-agent'], { from: 'user' })).rejects.toThrow(
        'process.exit(1)',
      );

      expect(consoleErrorOutput.join('\n')).toContain('Failed to fetch unpredicted rounds');
      expect(consoleErrorOutput.join('\n')).toContain('Network error');
    });

    it('handles non-Error exceptions', async () => {
      mockGetUnpredictedRounds.mockRejectedValue('String error');

      const command = createMegathreadListCommand();

      await expect(command.parseAsync(['--agent', 'test-agent'], { from: 'user' })).rejects.toThrow(
        'process.exit(1)',
      );

      expect(consoleErrorOutput.join('\n')).toContain('Failed to fetch unpredicted rounds');
      expect(consoleErrorOutput.join('\n')).toContain('String error');
    });
  });

  describe('works with different fixture agents', () => {
    it('works with empty-agent', async () => {
      mockGetUnpredictedRounds.mockResolvedValue([]);

      const command = createMegathreadListCommand();
      await command.parseAsync(['--agent', 'empty-agent'], { from: 'user' });

      const output = consoleOutput.join('\n');
      expect(output).toContain('Unpredicted Rounds for empty-agent');
    });
  });
});
