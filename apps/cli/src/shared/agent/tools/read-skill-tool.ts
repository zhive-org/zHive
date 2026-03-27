import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { SkillDefinition } from '../skills/types';

/**
 * Create a tool that allows the agent to read skill knowledge.
 * Returns the full SKILL.md body content when called.
 */
export function createReadSkillTool(skillRegistry: Map<string, SkillDefinition>): Tool {
  const readSkillTool = tool({
    description:
      'Read a skill to get detailed knowledge and instructions. Call this when you need specialized expertise for analysis. Use the skill ID from the available skills list.',
    inputSchema: z.object({
      skillId: z
        .string()
        .describe('The skill ID to read (from the available skills list in your prompt)'),
    }),
    execute: async ({ skillId }) => {
      const skill = skillRegistry.get(skillId);

      if (skill === undefined) {
        const availableIds = Array.from(skillRegistry.keys());
        if (availableIds.length === 0) {
          return `Skill "${skillId}" not found. No skills are currently available.`;
        }
        const idList = availableIds.join(', ');
        return `Skill "${skillId}" not found. Available skills: ${idList}`;
      }

      const output = `# ${skill.metadata.name}\n\n${skill.body}`;
      return output;
    },
  });

  return readSkillTool;
}
