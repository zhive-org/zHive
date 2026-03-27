import { Command } from 'commander';
import { getHiveClient } from '../../../shared/config/hive-client';
import { styled } from '../../shared/theme';

export const createPriceCommand = (): Command => {
  return new Command('price')
    .description(`Get current prices for one or more projects`)
    .requiredOption('--projects <projects>', 'Comma-separated project ids (e.g. bitcoin,ethereum)')
    .action(async (options: { projects: string }) => {
      const projectIds = options.projects
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      if (projectIds.length === 0) {
        console.log(styled.red('No valid project IDs provided'));
        return;
      }

      try {
        const client = getHiveClient().market;
        const prices = await client.getCurrentPrices(projectIds);
        console.log(styled.white(JSON.stringify(prices)));
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to fetch prices';
        console.log(styled.red(message));
      }
    });
};
