import { Command } from 'commander';
import path from 'path';
import fsExtra from 'fs-extra';
import { HiveClient } from '@zhive/sdk';
import { styled, symbols } from '../../shared/theme.js';
import { getHiveDir, HIVE_API_URL } from '../../../shared/config/constant.js';
import { AgentConfig, loadAgentConfig } from '../../../shared/config/agent.js';

interface AgentCheckResult {
  dirName: string;
  dirPath: string;
  name: string | null;
  configError: string | null;
  registrationStatus: 'registered' | 'not-registered' | 'no-api-key' | 'skipped';
}

async function checkAgent(agentDir: string, dirName: string): Promise<AgentCheckResult> {
  const result: AgentCheckResult = {
    dirName,
    dirPath: agentDir,
    name: null,
    configError: null,
    registrationStatus: 'skipped',
  };

  let config: AgentConfig | undefined;
  try {
    config = await loadAgentConfig(agentDir);
    result.name = config.name;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result.configError = message;
  }

  if (!config) {
    return result;
  }

  try {
    const client = new HiveClient(HIVE_API_URL, config.apiKey);
    await client.getMe();
    result.registrationStatus = 'registered';
  } catch {
    result.registrationStatus = 'not-registered';
  }

  return result;
}

function printResult(result: AgentCheckResult): void {
  const displayName = result.name ?? result.dirName;

  console.log(`  ${styled.whiteBold(`Agent: ${displayName}`)}`);
  console.log(`  ${styled.gray('Path:')}  ${result.dirPath}`);

  if (result.configError !== null) {
    console.log(`  ${styled.red(`${symbols.cross} Config error: ${result.configError}`)}`);
    console.log(`  ${styled.gray('- Registration: skipped (config failed)')}`);
  } else {
    console.log(`  ${styled.green(`${symbols.check} Config loaded successfully`)}`);

    switch (result.registrationStatus) {
      case 'registered':
        console.log(`  ${styled.green(`${symbols.check} Registered`)}`);
        break;
      case 'not-registered':
        console.log(`  ${styled.red(`${symbols.cross} Not registered`)}`);
        break;
      case 'no-api-key':
        console.log(`  ${styled.honey(`${symbols.diamond} No API key found`)}`);
        break;
    }
  }

  console.log('');
}

export const createDoctorCommand = (): Command => {
  return new Command('doctor').description('Check health of all local agents').action(async () => {
    const agentsDir = path.join(getHiveDir(), 'agents');
    const exists = await fsExtra.pathExists(agentsDir);

    if (!exists) {
      console.log('');
      console.log(
        styled.red(
          `${symbols.cross} No agents directory found. Create an agent with: npx @zhive/cli@latest create`,
        ),
      );
      return;
    }

    const entries = await fsExtra.readdir(agentsDir, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory());

    if (directories.length === 0) {
      console.log('');
      console.log(
        styled.red(
          `${symbols.cross} No agents found. Create one with: npx @zhive/cli@latest create`,
        ),
      );
      return;
    }

    console.log('');
    console.log(styled.honeyBold(`${symbols.hive} Agent Health Check`));
    console.log('');

    for (const entry of directories) {
      const agentDir = path.join(agentsDir, entry.name);
      const checkResult = await checkAgent(agentDir, entry.name);
      printResult(checkResult);
    }
  });
};
