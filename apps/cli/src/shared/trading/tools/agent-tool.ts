import * as ai from 'ai';
import z from 'zod';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import type { Tool, LanguageModel } from 'ai';

const { ToolLoopAgent, tool } = wrapAISDK(ai);

export const createAgentTool = ({
  model,
  tools,
}: {
  tools: Record<string, Tool>;
  model: LanguageModel;
}) =>
  tool({
    description: 'Spawn a new agent to perform a task.',
    inputSchema: z.object({
      instruction: z.string().describe('The instruction for the agent to execute.'),
    }),
    execute: async ({ instruction }) => {
      try {
        const agent = new ToolLoopAgent({
          model,
          instructions: `You are a helpful assistant. You task is to follow the given instruction. Your answer should be concise and to the point.`,
          tools,
        });

        const res = await agent.generate({ prompt: instruction });
        return res.text;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error executing agent instruction: ${message}`;
      }
    },
  });
