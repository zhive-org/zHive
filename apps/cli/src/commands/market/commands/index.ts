import { Command } from 'commander';
import { createPriceCommand } from './price';

export const createMarketCommand = (): Command => {
  return new Command('market').addCommand(createPriceCommand());
};
