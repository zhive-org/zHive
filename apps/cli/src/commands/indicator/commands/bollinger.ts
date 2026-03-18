import { Command } from 'commander';
import { InsufficientDataError } from '../../../shared/ta/error.js';
import { getBollingerBands } from '../../../shared/ta/service.js';
import { styled } from '../../shared/theme.js';

export const createBollingerCommand = (): Command => {
  return new Command('bollinger')
    .description(`Compute bollinger bands of given project's price`)
    .requiredOption('--project <project>', 'Project id')
    .option('--period <period>', 'bollinger bands period. Defaults to 20')
    .option('--interval <interval>', 'ohlc interval. valid options are [hourly, daily]')
    .action(
      async (options: { project: string; period?: string; interval?: 'hourly' | 'daily' }) => {
        const { project, period: periodStr = '20', interval = 'hourly' } = options;

        let period = Number(periodStr);
        if (Number.isNaN(period)) {
          console.log(styled.white(`Invalid period ${periodStr}. override to 20`));
          period = 20;
        }

        try {
          const bbResult = await getBollingerBands({
            project,
            interval,
            period,
            from: new Date(),
            to: new Date(),
          });
          const last = bbResult.at(-1) ?? {};
          console.log(styled.white(JSON.stringify(last)));
        } catch (e) {
          if (e instanceof InsufficientDataError) {
            console.log(
              styled.red(
                `Insufficient data: got ${e.got} data points but need at least ${e.required} for Bollinger Bands(${period}).`,
              ),
            );
            return;
          }

          console.log(styled.red(`Failed to fetch bollinger bands value`));
        }
      },
    );
};
