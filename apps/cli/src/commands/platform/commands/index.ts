import { Command } from 'commander';
import { detectPlatform } from '../../../shared/platform.js';

export const createPlatformCommand = (): Command => {
  return new Command('platform')
    .description('Detect what platform the CLI is running on')
    .action(() => {
      console.log(detectPlatform());
    });
};
