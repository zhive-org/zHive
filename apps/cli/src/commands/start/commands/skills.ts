import * as path from 'node:path';
import { AgentRuntime } from '../../../shared/agent';
import { discoverSkills } from '../../../shared/agent/skills/skill-parser';
import type { SkillDefinition } from '../../../shared/agent/skills/types';
import { getHiveDir } from '../../../shared/config/constant';
import { extractErrorMessage } from '../../../shared/megathread/utils';
import type { Result } from '../../../shared/types';
import { styled } from '../../shared/theme';
import { SlashCommandCallbacks } from '../services/command-registry';

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
  runtime: AgentRuntime,
  callbacks?: SlashCommandCallbacks,
): Promise<void> {
  const result = await fetchSkills(runtime.config.name);

  if (!result.success) {
    callbacks?.onError?.(result.error);
    return;
  }

  const formatted = formatSkills(result.data);
  callbacks?.onMessage?.(formatted);
}
