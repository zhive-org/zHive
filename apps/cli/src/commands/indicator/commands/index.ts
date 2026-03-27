import { Command } from 'commander';
import { createBollingerCommand } from './bollinger';
import { createEmaCommand } from './ema';
import { createMacdCommand } from './macd';
import { createRsiCommand } from './rsi';
import { createSmaCommand } from './sma';

export const createIndicatorCommand = (): Command => {
  return new Command('indicator')
    .addCommand(createRsiCommand())
    .addCommand(createSmaCommand())
    .addCommand(createEmaCommand())
    .addCommand(createMacdCommand())
    .addCommand(createBollingerCommand());
};
