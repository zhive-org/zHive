import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Kline } from 'pinets';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockedConsole, MockedConsole } from '../../../tests/console';
import { createTaExecuteCommand } from './execute';

const mockGetOHLC = vi.fn();

vi.mock('../../../shared/config/hive-client', () => ({
  getHiveClient: () => ({
    market: { getOHLC: mockGetOHLC },
  }),
}));

vi.mock('../../../shared/ta/data-provider', async () => {
  return {
    HiveDataProvider: vi.fn().mockImplementation(() => {
      // Return a provider whose getMarketData returns controlled data
      return {
        getMarketData: vi.fn().mockImplementation(async (): Promise<Kline[]> => {
          return generateKlines(200);
        }),
        getSymbolInfo: vi.fn().mockResolvedValue({ tickerid: 'bitcoin', ticker: 'bitcoin' }),
        configure: vi.fn(),
      };
    }),
  };
});

function generateKlines(count: number): Kline[] {
  const baseTime = new Date('2026-01-01T00:00:00Z').getTime();
  return Array.from({ length: count }, (_, i) => ({
    openTime: baseTime + i * 3_600_000,
    open: 100 + Math.sin(i / 5) * 10,
    high: 110 + Math.sin(i / 5) * 10,
    low: 90 + Math.sin(i / 5) * 10,
    close: 105 + Math.sin(i / 5) * 10,
    volume: 1000,
    closeTime: baseTime + (i + 1) * 3_600_000,
    quoteAssetVolume: 0,
    numberOfTrades: 0,
    takerBuyBaseAssetVolume: 0,
    takerBuyQuoteAssetVolume: 0,
    ignore: 0,
  }));
}

const rsiScript = `//@version=5
indicator("RSI")
rsiVal = ta.rsi(close, 14)
plot(rsiVal)`;

describe('ta execute command', () => {
  let mockedConsole: MockedConsole;
  let tmpDir: string;
  let pineFilePath: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ta-execute-test-'));
    pineFilePath = join(tmpDir, 'rsi.pine');
    await writeFile(pineFilePath, rsiScript, 'utf-8');
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedConsole = createMockedConsole();
  });

  describe('PineTS integration', () => {
    it('runs a real Pine Script against mock data and returns plot data', async () => {
      const command = createTaExecuteCommand();
      command.exitOverride();
      await command.parseAsync(
        [
          '--script',
          rsiScript,
          '--project',
          'bitcoin',
          '--fetchCandleCount',
          '200',
          '--returnCandleCount',
          '5',
        ],
        {
          from: 'user',
        },
      );

      const { output } = mockedConsole;

      const parsed = JSON.parse(output.join('')) as { [key: string]: any[] };
      const plotKeys = Object.keys(parsed);
      expect(plotKeys.length).toBeGreaterThanOrEqual(1);
      // Each plot should have exactly 5 values (returnCandleCount)
      for (const values of Object.values(parsed)) {
        expect(values).toHaveLength(5);
        // RSI values should be numbers between 0 and 100
        for (const val of values) {
          if (val !== null) {
            expect(typeof val).toBe('number');
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThanOrEqual(100);
          }
        }
      }
    });

    it('catches PineTS execution error and logs message', async () => {
      const command = createTaExecuteCommand();
      command.exitOverride();
      await command.parseAsync(
        ['--script', 'this is not valid pine script at all', '--project', 'bitcoin'],
        {
          from: 'user',
        },
      );

      const { err } = mockedConsole;

      expect(err.join('\n')).toContain('Failed to execute pine script');
    });

    it('runs a Pine Script from a file via --file', async () => {
      const command = createTaExecuteCommand();
      command.exitOverride();
      await command.parseAsync(
        [
          '--file',
          pineFilePath,
          '--project',
          'bitcoin',
          '--fetchCandleCount',
          '200',
          '--returnCandleCount',
          '5',
        ],
        { from: 'user' },
      );

      const { output } = mockedConsole;
      const parsed = JSON.parse(output.join('')) as { [key: string]: any[] };
      for (const values of Object.values(parsed)) {
        expect(values).toHaveLength(5);
      }
    });
  });

  describe('validation', () => {
    it('fails when both --script and --file are provided', async () => {
      const command = createTaExecuteCommand();
      command.exitOverride();
      await command.parseAsync(
        ['--script', rsiScript, '--file', pineFilePath, '--project', 'bitcoin'],
        { from: 'user' },
      );

      const { err } = mockedConsole;
      expect(err.join('\n')).toContain('Exactly one of --script or --file must be provided');
    });

    it('fails when neither --script nor --file is provided', async () => {
      const command = createTaExecuteCommand();
      command.exitOverride();
      await command.parseAsync(['--project', 'bitcoin'], { from: 'user' });

      const { err } = mockedConsole;
      expect(err.join('\n')).toContain('Exactly one of --script or --file must be provided');
    });

    it('fails with clear error for non-existent file', async () => {
      const command = createTaExecuteCommand();
      command.exitOverride();
      await command.parseAsync(
        ['--file', '/tmp/does-not-exist-12345.pine', '--project', 'bitcoin'],
        { from: 'user' },
      );

      const { err } = mockedConsole;
      expect(err.join('\n')).toContain('Failed to read script file');
    });
  });
});
