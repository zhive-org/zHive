import * as path from 'node:path';
import { getHiveDir } from '../../../shared/config/constant';
import { discoverSkills } from '../../../shared/agent/skills/skill-parser';
import type { SkillDefinition } from '../../../shared/agent/skills/types';
import { styled } from '../../shared/theme';
import type { Result } from '../../../shared/types';
import { extractErrorMessage } from '../../../shared/agent/utils';

export async function fetchSkills(agentName: string): Promise<Result<SkillDefinition[]>> {
  try {
    const hiveDir = getHiveDir();
    const skillsDir = path.join(hiveDir, 'agents', agentName, 'skills');
    const skills = await discoverSkills(skillsDir);
    return { success: true, data: skills };
  } catch (error) {
    const message = extractErrorMessage(error);
    return { success: false, error: message };
  }
}

export function formatSkills(skills: SkillDefinition[]): string {
  if (skills.length === 0) {
    return "No skills loaded. Add skills to your agent's skills/ directory.";
  }

  const lines = [styled.honeyBold('Available Skills:'), ''];

  for (const skill of skills) {
    const nameDisplay = styled.honey(skill.metadata.name);
    const descDisplay = skill.metadata.description;
    lines.push(`  ${nameDisplay}`);
    lines.push(`    ${descDisplay}`);
    if (skill.metadata.compatibility) {
      const compatDisplay = styled.dim(`[${skill.metadata.compatibility}]`);
      lines.push(`    ${compatDisplay}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export async function skillsSlashCommand(
  agentName: string,
  callbacks: {
    onSuccess?: (output: string) => void;
    onError?: (error: string) => void;
  },
): Promise<void> {
  const result = await fetchSkills(agentName);

  if (!result.success) {
    callbacks.onError?.(result.error);
    return;
  }

  const formatted = formatSkills(result.data);
  callbacks.onSuccess?.(formatted);
}
