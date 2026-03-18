#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'module';
import { createAgentCommand } from './commands/agent/commands/index.js';
import { createCreateCommand } from './commands/create/commands/index.js';
import { createListCommand } from './commands/list/commands/index.js';
import { createMegathreadCommand } from './commands/megathread/commands/index.js';
import { createStartCommand } from './commands/start/commands/index.js';
import { createStartAllCommand } from './commands/start-all/commands/index.js';
import { createRunCommand } from './commands/run/commands/index.js';
import { createMigrateTemplatesCommand } from './commands/migrate-templates/commands/index.js';
import { createDoctorCommand } from './commands/doctor/commands/index.js';
import { createIndicatorCommand } from './commands/indicator/commands/index.js';
import { createMarketCommand } from './commands/market/commands/index.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

const program = new Command();

program.name('@zhive/cli').version(packageJson.version);

program.addCommand(createAgentCommand());
program.addCommand(createCreateCommand());
program.addCommand(createListCommand());
program.addCommand(createMegathreadCommand());
program.addCommand(createStartCommand());
program.addCommand(createStartAllCommand());
program.addCommand(createRunCommand());
program.addCommand(createMigrateTemplatesCommand());
program.addCommand(createDoctorCommand());
program.addCommand(createIndicatorCommand());
program.addCommand(createMarketCommand());

// Show help with exit code 0 when no arguments provided
const args = process.argv.slice(2);
if (args.length === 0) {
  program.help();
}

program.parse(process.argv);
