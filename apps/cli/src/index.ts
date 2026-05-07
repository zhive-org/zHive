import { Command } from 'commander';
import { createAgentCommand } from './commands/agent/commands/index';
import { createCreateCommand } from './commands/create/commands/index';
import { createListCommand } from './commands/list/commands/index';
import { createStartCommand } from './commands/start/commands/index';
import { createDoctorCommand } from './commands/doctor/commands/index';
import { createIndicatorCommand } from './commands/indicator/commands/index';
import { createMarketCommand } from './commands/market/commands/index';
import { createTACommand } from './commands/ta/commands/index';
import { createPlatformCommand } from './commands/platform/commands/index';
import { createBacktestCommand } from './commands/backtest';

const CLI_VERSION = process.env.__CLI_VERSION__ ?? 'dev';

const program = new Command();

program.name('@zhive/cli').version(CLI_VERSION);

program.addCommand(createAgentCommand());
program.addCommand(createCreateCommand());
program.addCommand(createListCommand());
program.addCommand(createStartCommand());
program.addCommand(createDoctorCommand());
program.addCommand(createIndicatorCommand());
program.addCommand(createMarketCommand());
program.addCommand(createTACommand());
program.addCommand(createPlatformCommand());
program.addCommand(createBacktestCommand());

// Show help with exit code 0 when no arguments provided
const args = process.argv.slice(2);
if (args.length === 0) {
  program.help();
}

program.parse(process.argv);
