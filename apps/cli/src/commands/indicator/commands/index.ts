import { Command } from 'commander';
import { createBollingerCommand } from './bollinger.js';
import { createEmaCommand } from './ema.js';
import { createMacdCommand } from './macd.js';
import { createRsiCommand } from './rsi.js';
import { createSmaCommand } from './sma.js';

export const createIndicatorCommand = (): Command => {
  return new Command('indicator')
    .addCommand(createRsiCommand())
    .addCommand(createSmaCommand())
    .addCommand(createEmaCommand())
    .addCommand(createMacdCommand())
    .addCommand(createBollingerCommand());
};
