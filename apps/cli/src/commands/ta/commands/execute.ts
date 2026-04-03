import { Command } from 'commander';
import z from 'zod';
import { formatPineResult } from '../../../shared/ta/utils';
import { styled } from '../../shared/theme';
import { printZodError } from '../../shared/utils';
import path from 'node:path';
import { lstat, readFile } from 'node:fs/promises';
import { timeframeToMs } from '../../../shared/tools/pinescript/utils';
import { Timeframe } from '../../../shared/tools/pinescript/types';
import { convertTimeframeToInterval, getIntervalMs, getOHLC } from '../../../shared/ta/service';

const ALLOWED_EXTENSIONS = ['.pine', '.ps', '.txt'];
const MAX_SCRIPT_SIZE_BYTES = 512 * 1024; // 512 KB

function validateScriptPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  const ext = path.extname(resolved).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Invalid file extension "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  return resolved;
}

async function readScriptFile(filePath: string): Promise<string> {
  const resolved = validateScriptPath(filePath);

  const stats = await lstat(resolved);

  if (!stats.isFile()) {
    throw new Error('Path is not a regular file');
  }

  if (stats.size > MAX_SCRIPT_SIZE_BYTES) {
    throw new Error(
      `File too large (${stats.size} bytes). Max allowed: ${MAX_SCRIPT_SIZE_BYTES} bytes`,
    );
  }

  const content = await readFile(resolved, 'utf-8');

  if (content.length === 0) {
    throw new Error('Script file is empty');
  }

  return content;
}

const schema = z
  .object({
    script: z.string().optional(),
    file: z.string().optional(),
    project: z.string(),
    timeframe: z.enum([Timeframe['1h'], Timeframe['1d']]).default(Timeframe['1h']),
    fetchCandleCount: z.coerce.number().int().min(1).max(1500).default(100),
    returnCandleCount: z.coerce.number().int().min(1).max(100).default(10),
  })
  .refine((data) => Boolean(data.script) !== Boolean(data.file), {
    message: 'Exactly one of --script or --file must be provided',
  });

export const createTaExecuteCommand = () => {
  return new Command('execute')
    .description(
      'Execute a TradingView Pine Script against OHLC market data for a project and return indicator values',
    )
    .option('--script <script>', `Inline script source code`)
    .option('--file <path>', 'Path to a Pine Script file')
    .requiredOption('--project <project>', 'Project slug for market data i.e. bitcoin ')
    .option('--timeframe <timeframe>', 'Candle interval: 1h (hourly) or 24h (daily). Default: 1h')
    .option(
      '--fetchCandleCount <count>',
      'Number of historical candles to fetch. Indicators need lookback data, so set this higher than the indicator period (e.g. 200 for RSI 50). Default: 100',
    )
    .option(
      '--returnCandleCount <count>',
      'Number of most-recent candles to include in the response (default: 10)',
    )
    .action(async (options) => {
      const parseResult = schema.safeParse(options);
      if (!parseResult.success) {
        printZodError(parseResult);
        return;
      }

      const input = parseResult.data;

      let scriptSource: string;
      if (input.file) {
        try {
          scriptSource = scriptSource = await readScriptFile(input.file);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(styled.red(`Failed to read script file: ${message}`));
          return;
        }
      } else {
        scriptSource = input.script!;
      }

      const endTime = Date.now();
      const startTime = endTime - input.fetchCandleCount * timeframeToMs(input.timeframe);

      const interval = convertTimeframeToInterval(input.timeframe);
      const intervalMs = getIntervalMs(interval);

      const ohlcData = await getOHLC({
        project: input.project,
        from: new Date(startTime),
        to: new Date(endTime),
        interval,
      });

      const { PineTS } = await import('pinets');
      const klines = ohlcData.map(([timestamp, open, high, low, close]) => ({
        openTime: timestamp - intervalMs,
        closeTime: timestamp,
        open,
        high,
        low,
        close,
        volume: 0, // hive api doesn't support volume
      }));
      const pineTS = new PineTS(klines);
      try {
        const result = await pineTS.run(scriptSource);
        console.log(JSON.stringify(formatPineResult(result, input.returnCandleCount)));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid script';
        console.error(styled.red(`Failed to execute pine script: ${message}`));
      }
    });
};
