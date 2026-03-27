import { Command } from 'commander';
import { createTaExecuteCommand } from './execute';

export const createTACommand = () => {
  return new Command('ta').addCommand(createTaExecuteCommand());
};
