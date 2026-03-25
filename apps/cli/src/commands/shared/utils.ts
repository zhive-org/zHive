import z from 'zod';
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

export const printZodError = (result: z.ZodSafeParseError<any>) => {
  const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
  console.error(styled.red(`${symbols.cross} Validation error: ${errors}`));
};
