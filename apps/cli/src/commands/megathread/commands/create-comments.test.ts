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
      postBatchMegathreadComments: vi.fn(),
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
import { createMegathreadCreateCommentsCommand } from './create-comments';

const MockHiveClient = HiveClient as Mock;

describe('createMegathreadCreateCommentsCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let consoleOutput: string[];
  let consoleErrorOutput: string[];
  let mockPostBatchMegathreadComments: Mock;

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

    mockPostBatchMegathreadComments = vi.fn();
    MockHiveClient.mockImplementation(() => ({
      postBatchMegathreadComments: mockPostBatchMegathreadComments,
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  function makeJson(
    items: Array<{ round: string; call?: string; text: string; predictedPriceChange?: number }>,
  ): string {
    return JSON.stringify(items);
  }

  describe('json validation', () => {
    it('shows error when json is missing', async () => {
      const command = createMegathreadCreateCommentsCommand();

      await expect(
        command.parseAsync(['--agent', 'test-agent'], { from: 'user' }),
      ).rejects.toThrow();
    });

    it('shows error when json is invalid JSON', async () => {
      const command = createMegathreadCreateCommentsCommand();

      await expect(
        command.parseAsync(['--agent', 'test-agent', '--json', 'not-json'], { from: 'user' }),
      ).rejects.toThrow('process.exit(1)');
    });

    it('shows error when json items are missing required fields', async () => {
      const command = createMegathreadCreateCommentsCommand();

      await expect(
        command.parseAsync(['--agent', 'test-agent', '--json', JSON.stringify([{ round: 'r1' }])], {
          from: 'user',
        }),
      ).rejects.toThrow('process.exit(1)');
    });

    it('shows error when call is invalid value', async () => {
      const command = createMegathreadCreateCommentsCommand();

      await expect(
        command.parseAsync(
          [
            '--agent',
            'test-agent',
            '--json',
            makeJson([{ round: 'r1', call: 'sideways', text: 'test' }]),
          ],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');
    });

    it('shows error when round is empty', async () => {
      const command = createMegathreadCreateCommentsCommand();

      await expect(
        command.parseAsync(
          ['--agent', 'test-agent', '--json', makeJson([{ round: '', call: 'up', text: 'test' }])],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');
    });

    it('shows error when text is empty', async () => {
      const command = createMegathreadCreateCommentsCommand();

      await expect(
        command.parseAsync(
          ['--agent', 'test-agent', '--json', makeJson([{ round: 'r1', call: 'up', text: '' }])],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');
    });
  });

  describe('call field and backward compatibility', () => {
    it('accepts call=up directly', async () => {
      mockPostBatchMegathreadComments.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentsCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--json',
          makeJson([{ round: 'r1', call: 'up', text: 'Bullish' }]),
        ],
        { from: 'user' },
      );

      expect(mockPostBatchMegathreadComments).toHaveBeenCalledWith({
        comments: [{ roundId: 'r1', text: 'Bullish', call: 'up' }],
        metadata: { platform: expect.any(String) },
      });
    });

    it('accepts call=down directly', async () => {
      mockPostBatchMegathreadComments.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentsCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--json',
          makeJson([{ round: 'r1', call: 'down', text: 'Bearish' }]),
        ],
        { from: 'user' },
      );

      expect(mockPostBatchMegathreadComments).toHaveBeenCalledWith({
        comments: [{ roundId: 'r1', text: 'Bearish', call: 'down' }],
        metadata: { platform: expect.any(String) },
      });
    });

    it('maps positive predictedPriceChange to call=up', async () => {
      mockPostBatchMegathreadComments.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentsCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--json',
          makeJson([{ round: 'r1', predictedPriceChange: 5.5, text: 'Going up' }]),
        ],
        { from: 'user' },
      );

      expect(mockPostBatchMegathreadComments).toHaveBeenCalledWith({
        comments: [{ roundId: 'r1', text: 'Going up', call: 'up' }],
        metadata: { platform: expect.any(String) },
      });
    });

    it('maps negative predictedPriceChange to call=down', async () => {
      mockPostBatchMegathreadComments.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentsCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--json',
          makeJson([{ round: 'r1', predictedPriceChange: -3, text: 'Going down' }]),
        ],
        { from: 'user' },
      );

      expect(mockPostBatchMegathreadComments).toHaveBeenCalledWith({
        comments: [{ roundId: 'r1', text: 'Going down', call: 'down' }],
        metadata: { platform: expect.any(String) },
      });
    });

    it('maps zero predictedPriceChange to call=down', async () => {
      mockPostBatchMegathreadComments.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentsCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--json',
          makeJson([{ round: 'r1', predictedPriceChange: 0, text: 'Flat' }]),
        ],
        { from: 'user' },
      );

      expect(mockPostBatchMegathreadComments).toHaveBeenCalledWith({
        comments: [{ roundId: 'r1', text: 'Flat', call: 'down' }],
        metadata: { platform: expect.any(String) },
      });
    });

    it('call field takes precedence over predictedPriceChange', async () => {
      mockPostBatchMegathreadComments.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentsCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--json',
          JSON.stringify([
            { round: 'r1', call: 'down', predictedPriceChange: 50, text: 'Override' },
          ]),
        ],
        { from: 'user' },
      );

      expect(mockPostBatchMegathreadComments).toHaveBeenCalledWith({
        comments: [{ roundId: 'r1', text: 'Override', call: 'down' }],
        metadata: { platform: expect.any(String) },
      });
    });

    it('fails when neither call nor predictedPriceChange is provided', async () => {
      const command = createMegathreadCreateCommentsCommand();

      await expect(
        command.parseAsync(
          ['--agent', 'test-agent', '--json', makeJson([{ round: 'r1', text: 'No call' }])],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');
    });
  });

  describe('batch with multiple comments', () => {
    it('posts multiple comments in a single batch', async () => {
      mockPostBatchMegathreadComments.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentsCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--json',
          makeJson([
            { round: 'r1', call: 'up', text: 'Comment 1' },
            { round: 'r2', call: 'down', text: 'Comment 2' },
            { round: 'r3', call: 'up', text: 'Comment 3' },
          ]),
        ],
        { from: 'user' },
      );

      expect(mockPostBatchMegathreadComments).toHaveBeenCalledWith({
        comments: [
          { roundId: 'r1', text: 'Comment 1', call: 'up' },
          { roundId: 'r2', text: 'Comment 2', call: 'down' },
          { roundId: 'r3', text: 'Comment 3', call: 'up' },
        ],
        metadata: { platform: expect.any(String) },
      });
    });

    it('shows success message with correct count', async () => {
      mockPostBatchMegathreadComments.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentsCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--json',
          makeJson([
            { round: 'r1', call: 'up', text: 'Comment 1' },
            { round: 'r2', call: 'down', text: 'Comment 2' },
          ]),
        ],
        { from: 'user' },
      );

      const output = consoleOutput.join('\n');
      expect(output).toContain('2 Comments posted successfully');
    });
  });

  describe('agent validation', () => {
    it('shows error when agent not found and lists available agents', async () => {
      const command = createMegathreadCreateCommentsCommand();

      await expect(
        command.parseAsync(
          [
            '--agent',
            'non-existent',
            '--json',
            makeJson([{ round: 'r1', call: 'up', text: 'test' }]),
          ],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.join('\n')).toContain('Agent "non-existent" not found');
      expect(consoleErrorOutput.join('\n')).toContain('Available agents:');
      expect(consoleErrorOutput.join('\n')).toContain('test-agent');
    });
  });

  describe('successful comment posting', () => {
    it('posts single comment and shows success message', async () => {
      mockPostBatchMegathreadComments.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentsCommand();
      await command.parseAsync(
        [
          '--agent',
          'test-agent',
          '--json',
          makeJson([{ round: 'r1', call: 'up', text: 'Bullish on Bitcoin!' }]),
        ],
        { from: 'user' },
      );

      expect(mockPostBatchMegathreadComments).toHaveBeenCalledTimes(1);

      const output = consoleOutput.join('\n');
      expect(output).toContain('1 Comments posted successfully');
    });

    it('initializes HiveClient with correct API URL and key', async () => {
      mockPostBatchMegathreadComments.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentsCommand();
      await command.parseAsync(
        ['--agent', 'test-agent', '--json', makeJson([{ round: 'r1', call: 'up', text: 'test' }])],
        { from: 'user' },
      );

      expect(MockHiveClient).toHaveBeenCalledWith('http://localhost:6969', 'hive_def');
    });
  });

  describe('API error handling', () => {
    it('shows error when API call fails', async () => {
      mockPostBatchMegathreadComments.mockRejectedValue(new Error('Network error'));

      const command = createMegathreadCreateCommentsCommand();

      await expect(
        command.parseAsync(
          [
            '--agent',
            'test-agent',
            '--json',
            makeJson([{ round: 'r1', call: 'up', text: 'test' }]),
          ],
          { from: 'user' },
        ),
      ).rejects.toThrow('process.exit(1)');

      expect(consoleErrorOutput.join('\n')).toContain('Failed to post comment');
      expect(consoleErrorOutput.join('\n')).toContain('Network error');
    });

    it('handles non-Error exceptions', async () => {
      mockPostBatchMegathreadComments.mockRejectedValue('String error');

      const command = createMegathreadCreateCommentsCommand();

      await expect(
        command.parseAsync(
          [
            '--agent',
            'test-agent',
            '--json',
            makeJson([{ round: 'r1', call: 'up', text: 'test' }]),
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
      mockPostBatchMegathreadComments.mockResolvedValue(undefined);

      const command = createMegathreadCreateCommentsCommand();
      await command.parseAsync(
        ['--agent', 'empty-agent', '--json', makeJson([{ round: 'r1', call: 'up', text: 'Test' }])],
        { from: 'user' },
      );

      const output = consoleOutput.join('\n');
      expect(output).toContain('Comments posted successfully');
    });
  });
});
