import { Command } from 'commander';
import { HiveClient, RewardDto } from '@zhive/sdk';
import { styled, symbols } from '../../shared/theme.js';
import { scanAgents, AgentConfig } from '../../../shared/config/agent.js';
import { HIVE_API_URL } from '../../../shared/config/constant.js';

interface AgentRewardResult {
  agent: AgentConfig;
  rewards: RewardDto[];
  error: string | null;
}

async function fetchAgentRewards(agent: AgentConfig): Promise<AgentRewardResult> {
  try {
    const client = new HiveClient(HIVE_API_URL, agent.apiKey);
    const rewards = await client.getRewards();
    return { agent, rewards, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { agent, rewards: [], error: message };
  }
}

function printRewards(results: AgentRewardResult[]): void {
  for (const result of results) {
    if (result.error) {
      console.log(`  ${styled.whiteBold(result.agent.name)}`);
      console.log(`    ${styled.red(`${symbols.cross} ${result.error}`)}`);
      console.log('');
      continue;
    }

    console.log(`  ${styled.whiteBold(result.agent.name)}`);

    if (result.rewards.length === 0) {
      console.log(`    ${styled.gray('No rewards yet.')}`);
      console.log('');
      continue;
    }

    for (const reward of result.rewards) {
      console.log(`    ${styled.honey(`${symbols.diamond} ${reward.name}`)}`);
      if (reward.description) {
        console.log(`      ${styled.gray(reward.description)}`);
      }
      console.log(`      ${styled.gray('Event:')} ${reward.eventName}`);
      console.log(`      ${styled.gray('Code:')}  ${styled.honeyBold(reward.claimCode)}`);
      if (reward.expiresAt) {
        console.log(`      ${styled.gray('Expires:')} ${reward.expiresAt}`);
      }
      if (reward.claimInstructions) {
        console.log(`      ${styled.honey(`${symbols.arrow} ${reward.claimInstructions}`)}`);
      }
    }
    console.log('');
  }
}

export const createRewardCommand = (): Command => {
  return new Command('reward').description('Check rewards for your agents').action(async () => {
    console.log('');
    console.log(styled.honeyBold(`${symbols.hive} Agent Rewards`));
    console.log('');

    const agents = await scanAgents();

    if (agents.length === 0) {
      console.log(
        styled.red(
          `${symbols.cross} No agents found. Create one with: npx @zhive/cli@latest create`,
        ),
      );
      return;
    }

    console.log(styled.gray(`  Checking ${agents.length} agent(s)...`));
    console.log('');

    const results = await Promise.all(agents.map(fetchAgentRewards));
    printRewards(results);
  });
};
