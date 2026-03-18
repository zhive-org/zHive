import { Command } from 'commander';
import { createPriceCommand } from './price.js';

export const createMarketCommand = (): Command => {
  return new Command('market').addCommand(createPriceCommand());
};
