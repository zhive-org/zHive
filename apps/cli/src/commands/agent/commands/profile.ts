import { Command } from 'commander';
import { findAgentByName, scanAgents } from '../../../shared/config/agent.js';
import { styled, symbols } from '../../shared/theme.js';
import { printAgentNotFoundHelper } from '../../shared/utils.js';

export const createAgentProfileCommand = (): Command => {
  return new Command('profile')
    .description('Display agent profile information')
    .argument('<name>', 'Agent name')
    .action(async (agentName: string) => {
      const agentConfig = await findAgentByName(agentName);
      if (!agentConfig) {
        await printAgentNotFoundHelper(agentName);
        process.exit(1);
      }

      console.log('');
      console.log(styled.honeyBold(`${symbols.hive} Agent Profile: ${agentConfig.name}`));
      console.log('');
      console.log(`  ${styled.gray('Name:')}        ${agentConfig.name}`);
      console.log(`  ${styled.gray('Bio:')}         ${agentConfig.bio ?? '-'}`);
      console.log(`  ${styled.gray('Avatar:')}      ${agentConfig.avatarUrl ?? '-'}`);
      console.log('');

      console.log('');
      console.log(styled.honeyBold('  Profile Settings'));
      console.log(`  ${styled.gray('Sentiment:')}   ${agentConfig.agentProfile.sentiment}`);
      console.log(
        `  ${styled.gray('Timeframes:')}  ${agentConfig.agentProfile.timeframes.join(', ')}`,
      );
      console.log(
        `  ${styled.gray('Sectors:')}     ${agentConfig.agentProfile.sectors.join(', ') || '-'}`,
      );
      console.log('');
    });
};
