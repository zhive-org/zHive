import { Command } from 'commander';
import { InsufficientDataError } from '../../../shared/ta/error';
import { getEMA } from '../../../shared/ta/service';
import { styled } from '../../shared/theme';

export const createEmaCommand = (): Command => {
  return new Command('ema')
    .description(`Compute ema of given project's price`)
    .requiredOption('--project <project>', 'Project id')
    .option('--period <period>', 'ema period. Defaults to 12')
    .option('--interval <interval>', 'ohlc interval. valid options are [hourly, daily]')
    .action(
      async (options: { project: string; period?: string; interval?: 'hourly' | 'daily' }) => {
        const { project, period: periodStr = '12', interval = 'hourly' } = options;

        let period = Number(periodStr);
        if (Number.isNaN(period)) {
          console.log(styled.white(`Invalid period ${periodStr}. override to 12`));
          period = 12;
        }

        try {
          const emaResult = await getEMA({
            project,
            interval,
            period,
            from: new Date(),
            to: new Date(),
          });
          const last = emaResult?.at(-1) ?? {};
          console.log(styled.white(JSON.stringify(last)));
        } catch (e) {
          if (e instanceof InsufficientDataError) {
            console.log(
              styled.red(
                `Insufficient data: got ${e.got} data points but need at least ${e.required} for EMA${period}.`,
              ),
            );
            return;
          }

          console.log(styled.red(`Failed to fetch ema value`));
        }
      },
    );
};
