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

vi.mock('@zhive/sdk', async () => {
  const actual = await vi.importActual('@zhive/sdk');
  return {
    ...actual,
    HiveClient: vi.fn().mockImplementation(() => ({
      postMegathreadComment: vi.fn(),
    })),
  };
});

vi.mock('../../shared/theme', () => ({
  styled: {
    red: (text: string) => text,
    gray: (text: string) => text,
    green: (text: string) => text,
  },
  symbols: {
    cross: '✗',
    check: '✓',
  },
}));

import { HiveClient } from '@zhive/sdk';
import { createMegathreadCreateCommentCommand } from './create-comment';

const MockHiveClient = HiveClient as Mock;

describe('createMegathreadCreateCommentCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let consoleOutput: string[];
  let consoleErrorOutput: string[];
  let mockPostMegathreadComment: Mock;

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

    mockPostMegathreadComment = vi.fn();
    MockHiveClient.mockImplementation(() => ({
      postMegathreadComment: mockPostMegathreadComment,
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('conviction validation', () => {
    it('shows error when conviction is too high', async () => {
      const command = createMegathreadCreateCommentCommand();

      await expect(
        command.parseAsync(
          [
            '--agent',
            'test-agent',
            '--round',
            'round-123',
            '--conviction',
            '150',
            '--text',
            'Test comment',
          ],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.join('\n')).toContain('conviction');
      expect(consoleErrorOutput.join('\n')).toContain('100');
    });

    it('shows error when conviction is too low', async () => {
      const command = createMegathreadCreateCommentCommand();

      await expect(
        command.parseAsync(
          [
            '--agent',
            'test-agent',
            '--round',
            'round-123',
            '--conviction',
            '-150',
            '--text',
            'Test comment',
          ],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.join('\n')).toContain('conviction');
      expect(consoleErrorOutput.join('\n')).toContain('-100');
    });

    it('shows error when conviction or predictedPriceChange is not provided', async () => {
      const command = createMegathreadCreateCommentCommand();

      await expect(
        command.parseAsync(
          ['--agent', 'test-agent', '--round', 'round-123', '--text', 'Test comment'],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.join('\n')).toContain(
        'Either --conviction or --predictedPriceChange should be provided',
      );
    });

    it('shows error when conviction is not a number', async () => {
      const command = createMegathreadCreateCommentCommand();

      await expect(
        command.parseAsync(
          [
            '--agent',
            'test-agent',
            '--round',
            'round-123',
            '--conviction',
            'abc',
            '--text',
            'Test comment',
          ],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.join('\n')).toContain('conviction');
      expect(consoleErrorOutput.join('\n')).toContain('number');
    });

    it('accepts valid conviction at upper boundary', async () => {
      mockPostMegathreadComment.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--round',
          'round-123',
          '--conviction',
          '100',
          '--text',
          'Test comment',
        ],
        { from: 'user' },
      );

      expect(mockPostMegathreadComment).toHaveBeenCalledWith('round-123', {
        text: 'Test comment',
        conviction: 100,
      });
    });

    it('accepts valid conviction at lower boundary', async () => {
      mockPostMegathreadComment.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--round',
          'round-123',
          '--conviction',
          '-100',
          '--text',
          'Test comment',
        ],
        { from: 'user' },
      );

      expect(mockPostMegathreadComment).toHaveBeenCalledWith('round-123', {
        text: 'Test comment',
        conviction: -100,
      });
    });

    it('accepts valid predictedPriceChange at lower boundary', async () => {
      mockPostMegathreadComment.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--round',
          'round-123',
          '--predictedPriceChange',
          '-100',
          '--text',
          'Test comment',
        ],
        { from: 'user' },
      );

      expect(mockPostMegathreadComment).toHaveBeenCalledWith('round-123', {
        text: 'Test comment',
        conviction: -100,
      });
    });

    it('accepts decimal conviction values', async () => {
      mockPostMegathreadComment.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--round',
          'round-123',
          '--conviction',
          '25.5',
          '--text',
          'Test comment',
        ],
        { from: 'user' },
      );

      expect(mockPostMegathreadComment).toHaveBeenCalledWith('round-123', {
        text: 'Test comment',
        conviction: 25.5,
      });
    });
  });

  describe('agent validation', () => {
    it('shows error when agent not found and lists available agents', async () => {
      const command = createMegathreadCreateCommentCommand();

      await expect(
        command.parseAsync(
          [
            '--agent',
            'non-existent',
            '--round',
            'round-123',
            '--conviction',
            '50',
            '--text',
            'Test comment',
          ],
          { from: 'user' },
        ),
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
      const command = createMegathreadCreateCommentCommand();

      await expect(
        command.parseAsync(
          [
            '--agent',
            'no-cred',
            '--round',
            'round-123',
            '--conviction',
            '50',
            '--text',
            'Test comment',
          ],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.join('\n')).toContain('Agent "no-cred" not found');
    });
  });

  describe('successful comment posting', () => {
    it('posts comment and shows success message', async () => {
      mockPostMegathreadComment.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--round',
          'round-123',
          '--conviction',
          '50',
          '--text',
          'Bullish on Bitcoin!',
        ],
        { from: 'user' },
      );

      expect(mockPostMegathreadComment).toHaveBeenCalledWith('round-123', {
        text: 'Bullish on Bitcoin!',
        conviction: 50,
      });

      const output = consoleOutput.join('\n');
      expect(output).toContain('Comment posted successfully');
      expect(output).toContain('round-123');
      expect(output).toContain('+50.0%');
      expect(output).toContain('Bullish on Bitcoin!');
    });

    it('formats negative conviction correctly', async () => {
      mockPostMegathreadComment.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--round',
          'round-123',
          '--conviction',
          '-30',
          '--text',
          'Bearish outlook',
        ],
        { from: 'user' },
      );

      const output = consoleOutput.join('\n');
      expect(output).toContain('-30.0%');
    });

    it('truncates long text in success message', async () => {
      mockPostMegathreadComment.mockResolvedValue(undefined);

      const longText = 'A'.repeat(100);
      const command = createMegathreadCreateCommentCommand();
      await command.parseAsync(
        ['--agent', 'test-agent', '--round', 'round-123', '--conviction', '25', '--text', longText],
        { from: 'user' },
      );

      // Verify full text was sent to API
      expect(mockPostMegathreadComment).toHaveBeenCalledWith('round-123', {
        text: longText,
        conviction: 25,
      });

      // Verify truncated display
      const output = consoleOutput.join('\n');
      expect(output).toContain('A'.repeat(50) + '...');
    });
  });

  describe('API error handling', () => {
    it('shows error when API call fails', async () => {
      mockPostMegathreadComment.mockRejectedValue(new Error('Network error'));

      const command = createMegathreadCreateCommentCommand();

      await expect(
        command.parseAsync(
          [
            '--agent',
            'test-agent',
            '--round',
            'round-123',
            '--conviction',
            '50',
            '--text',
            'Test comment',
          ],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.join('\n')).toContain('Failed to post comment');
      expect(consoleErrorOutput.join('\n')).toContain('Network error');
    });

    it('handles non-Error exceptions', async () => {
      mockPostMegathreadComment.mockRejectedValue('String error');

      const command = createMegathreadCreateCommentCommand();

      await expect(
        command.parseAsync(
          [
            '--agent',
            'test-agent',
            '--round',
            'round-123',
            '--conviction',
            '50',
            '--text',
            'Test comment',
          ],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.join('\n')).toContain('Failed to post comment');
      expect(consoleErrorOutput.join('\n')).toContain('String error');
    });
  });

  describe('works with different fixture agents', () => {
    it('works with empty-agent', async () => {
      mockPostMegathreadComment.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentCommand();
      await command.parseAsync(
        [
          '--agent',
          'empty-agent',
          '--round',
          'round-123',
          '--conviction',
          '50',
          '--text',
          'Test comment',
        ],
        { from: 'user' },
      );

      const output = consoleOutput.join('\n');
      expect(output).toContain('Comment posted successfully');
    });
  });
});
