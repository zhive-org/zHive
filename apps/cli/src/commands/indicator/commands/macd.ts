import { Command } from 'commander';
import { InsufficientDataError } from '../../../shared/ta/error.js';
import { getMACD } from '../../../shared/ta/service.js';
import { styled } from '../../shared/theme.js';

export const createMacdCommand = (): Command => {
  return new Command('macd')
    .description(`Compute macd of given project's price`)
    .requiredOption('--project <project>', 'Project id')
    .option('--fast <fast>', 'fast ema period. Defaults to 12')
    .option('--slow <slow>', 'slow ema period. Defaults to 26')
    .option('--signal <signal>', 'signal line period. Defaults to 9')
    .option('--interval <interval>', 'ohlc interval. valid options are [hourly, daily]')
    .action(
      async (options: {
        project: string;
        fast?: string;
        slow?: string;
        signal?: string;
        interval?: 'hourly' | 'daily';
      }) => {
        const {
          project,
          fast: fastStr = '12',
          slow: slowStr = '26',
          signal: signalStr = '9',
          interval = 'hourly',
        } = options;

        let fast = Number(fastStr);
        if (Number.isNaN(fast)) {
          console.log(styled.white(`Invalid fast period ${fastStr}. override to 12`));
          fast = 12;
        }

        let slow = Number(slowStr);
        if (Number.isNaN(slow)) {
          console.log(styled.white(`Invalid slow period ${slowStr}. override to 26`));
          slow = 26;
        }

        let signal = Number(signalStr);
        if (Number.isNaN(signal)) {
          console.log(styled.white(`Invalid signal period ${signalStr}. override to 9`));
          signal = 9;
        }

        try {
          const macdResult = await getMACD({
            project,
            interval,
            fast,
            slow,
            signal,
            from: new Date(),
            to: new Date(),
          });
          const last = macdResult?.at(-1) ?? {};
          console.log(styled.white(JSON.stringify(last)));
        } catch (e) {
          if (e instanceof InsufficientDataError) {
            console.log(
              styled.red(
                `Insufficient data: got ${e.got} data points but need at least ${e.required} for MACD(${fast},${slow},${signal}).`,
              ),
            );
            return;
          }

          console.log(styled.red(`Failed to fetch macd value`));
        }
      },
    );
};
