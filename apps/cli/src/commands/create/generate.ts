import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'node:url';
import type { AIProvider } from '../../shared/config/ai-providers.js';
import { getHiveDir } from '../../shared/config/constant.js';
import { RegisterAgentDto, Sentiment, Timeframe, registerAgent } from '@zhive/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ScaffoldCallbacks {
  onStep: (label: string) => void;
  onDone: (projectDir: string) => void;
  onError: (message: string) => void;
}

export async function scaffoldProject({
  agent,
  apiKey,
  callbacks,
  provider,
  soulContent,
  strategyContent,
}: {
  agent: {
    name: string;
    bio: string;
    avatarUrl: string;
    sectors: string[];
    sentiment: string;
    timeframes: string[];
  };
  provider: AIProvider;
  apiKey: string;
  soulContent: string;
  strategyContent: string;
  callbacks: ScaffoldCallbacks;
}): Promise<void> {
  // Validate project name to prevent path traversal / command injection
  if (!/^[a-zA-Z0-9_-]+$/.test(agent.name)) {
    callbacks.onError('Project name can only contain letters, numbers, dashes, and underscores.');
    return;
  }

  const agentsDir = path.join(getHiveDir(), 'agents');
  const projectDir = path.join(agentsDir, agent.name);

  // Ensure resolved path is still inside the agents directory
  const normalizedProjectDir = path.resolve(projectDir);
  const normalizedAgentsDir = path.resolve(agentsDir);
  if (!normalizedProjectDir.startsWith(normalizedAgentsDir + path.sep)) {
    callbacks.onError('Invalid project name: path traversal detected.');
    return;
  }

  if (await fs.pathExists(projectDir)) {
    callbacks.onError(
      `Directory ${normalizedProjectDir} already exists. Run "npx @zhive/cli@latest create" again with a different name.`,
    );
    return;
  }

  // 1. Create directory
  callbacks.onStep('Creating project directory');
  await fs.ensureDir(projectDir);

  // 2. Write SOUL.md and STRATEGY.md
  callbacks.onStep('Writing personality files');
  await fs.writeFile(path.join(projectDir, 'SOUL.md'), soulContent, 'utf-8');
  await fs.writeFile(path.join(projectDir, 'STRATEGY.md'), strategyContent, 'utf-8');

  const seedMemory = `# Memory

## Key Learnings

(none yet)

## Market Observations

(none yet)

## Session Notes

(none yet)`;

  await fs.writeFile(path.join(projectDir, 'MEMORY.md'), seedMemory, 'utf-8');

  // 3. Write .env
  callbacks.onStep('Writing environment file');
  const envContent = `${provider.envVar}="${apiKey}"
`;
  await fs.writeFile(path.join(projectDir, '.env'), envContent, { encoding: 'utf-8', mode: 0o600 });

  // 4. register agent
  await registerAgent(
    {
      agent_profile: {
        sectors: agent.sectors,
        sentiment: agent.sentiment as Sentiment,
        timeframes: agent.timeframes as Timeframe[],
      },
      name: agent.name,
      avatar_url: agent.avatarUrl,
      bio: agent.bio,
    },
    normalizedProjectDir,
  )
    .then(() => callbacks.onDone(normalizedProjectDir))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      callbacks.onError(message);
    });
}
