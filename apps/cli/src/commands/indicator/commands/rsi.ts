import { Command } from 'commander';
import { InsufficientDataError } from '../../../shared/ta/error.js';
import { getRSI } from '../../../shared/ta/service.js';
import { styled } from '../../shared/theme.js';

export const createRsiCommand = (): Command => {
  return new Command('rsi')
    .description(`Compute rsi of given project's price`)
    .requiredOption('--project <project>', 'Project id')
    .option('--period <period>', 'rsi period. Defaults to 14')
    .option('--interval <interval>', 'ohlc interval. valid options are [hourly, daily]')
    .action(
      async (options: { project: string; period?: string; interval?: 'hourly' | 'daily' }) => {
        const { project, period: periodStr = '14', interval = 'hourly' } = options;

        let period = Number(periodStr);
        if (Number.isNaN(period)) {
          console.log(styled.white(`Invalid period ${periodStr}. override to 14`));
          period = 14;
        }

        try {
          const rsi = await getRSI({
            project,
            interval,
            period,
            from: new Date(),
            to: new Date(),
          });
          const last = rsi.at(-1) ?? {};
          console.log(styled.white(JSON.stringify(last)));
        } catch (e) {
          if (e instanceof InsufficientDataError) {
            console.log(
              styled.red(
                `Insufficient data: got ${e.got} data points but need at least ${e.required} for RSI${period}.`,
              ),
            );
            return;
          }

          console.log(styled.red(`Failed to fetch rsi value`));
        }
      },
    );
};
