import { scanAgents } from '../../shared/config/agent.js';
import { styled, symbols } from './theme.js';

export const printAgentNotFoundHelper = async (agentName: string) => {
  const agents = await scanAgents();
  if (agents.length === 0) {
    console.error(
      styled.red(`${symbols.cross} No agents found. Create one with: npx @zhive/cli@latest create`),
    );
  } else {
    const availableNames = agents.map((a) => a.name).join(', ');
    console.error(
      styled.red(
        `${symbols.cross} Agent "${agentName}" not found. Available agents: ${availableNames}`,
      ),
    );
  }
};
