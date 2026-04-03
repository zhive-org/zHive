import { join } from 'path';
import { SkillDefinition } from './types';
import { discoverSkills } from './skill-parser';

/**
 * Load skills from agent's skills/ directory.
 */
export async function loadSkills(agentPath?: string): Promise<Map<string, SkillDefinition>> {
  const skillRegistry: Map<string, SkillDefinition> = new Map();

  const skillsPath = join(agentPath ?? process.cwd(), 'skills');
  const agentSkills = await discoverSkills(skillsPath);

  for (const skill of agentSkills) {
    skillRegistry.set(skill.id, skill);
  }

  return skillRegistry;
}
