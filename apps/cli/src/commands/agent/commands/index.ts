import { Command } from 'commander';
import { createAgentProfileCommand } from './profile';

export function createAgentCommand(): Command {
  const agentCommand = new Command('agent').description('Agent management commands');

  agentCommand.addCommand(createAgentProfileCommand());

  return agentCommand;
}
