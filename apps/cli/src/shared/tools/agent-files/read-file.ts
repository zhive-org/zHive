import { tool } from 'ai';
import * as path from 'path';
import { z } from 'zod';
import { extractErrorMessage } from '../../megathread/utils';
import { assertReadable, readWithCap, resolveAgentPath } from './sandbox';

export function createReadFileTool(agentDir: string) {
  return tool({
    description:
      'Read a text file inside the current agent directory. Path is relative to the agent folder. Cannot read .env, config.json, or files containing credentials. Allowed extensions: .md, .json, .jsonl, .txt, .yaml, .yml. Files over 64KB are truncated.',
    inputSchema: z.object({
      path: z
        .string()
        .describe('Path to the file relative to the agent directory (e.g. "STRATEGY.md").'),
    }),
    execute: async ({ path: requestedPath }) => {
      try {
        const abs = await resolveAgentPath(agentDir, requestedPath);
        assertReadable(path.basename(abs));
        const { content, truncated } = await readWithCap(abs);
        return { path: requestedPath, content, truncated };
      } catch (err) {
        return { error: extractErrorMessage(err) };
      }
    },
  });
}
