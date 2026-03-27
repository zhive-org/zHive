import { Command } from 'commander';
import { InsufficientDataError } from '../../../shared/ta/error';
import { getSMA } from '../../../shared/ta/service';
import { styled } from '../../shared/theme';

export const createSmaCommand = (): Command => {
  return new Command('sma')
    .description(`Compute sma of given project's price`)
    .requiredOption('--project <project>', 'Project id')
    .option('--period <period>', 'sma period. Defaults to 20')
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
          const sma = await getSMA({
            project,
            interval,
            period,
            from: new Date(),
            to: new Date(),
          });
          const last = sma.at(-1) ?? {};
          console.log(styled.white(JSON.stringify(last)));
        } catch (e) {
          if (e instanceof InsufficientDataError) {
            console.log(
              styled.red(
                `Insufficient data: got ${e.got} data points but need at least ${e.required} for SMA${period}.`,
              ),
            );
            return;
          }

          console.log(styled.red(`Failed to fetch sma value`));
        }
      },
    );
};
