import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { SkillDefinition, SkillMetadata } from './types.js';
import { extractErrorMessage } from '../utils.js';

/**
 * Parse YAML frontmatter from SKILL.md content.
 * Expected format:
 * ---
 * name: skill-name
 * description: Skill description
 * ---
 * Body content...
 */
export function parseFrontmatter(content: string): { metadata: SkillMetadata; body: string } {
  const trimmed = content.trim();

  if (!trimmed.startsWith('---')) {
    throw new Error('SKILL.md must start with YAML frontmatter (---)');
  }

  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) {
    throw new Error('SKILL.md frontmatter is not closed (missing closing ---)');
  }

  const frontmatterContent = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 3).trim();

  const metadata: SkillMetadata = {
    name: '',
    description: '',
  };

  const lines = frontmatterContent.split('\n');
  let currentKey: string | null = null;
  let currentValue = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('name:')) {
      if (currentKey !== null) {
        setMetadataField(metadata, currentKey, currentValue.trim());
      }
      currentKey = 'name';
      currentValue = trimmedLine.slice(5).trim();
    } else if (trimmedLine.startsWith('description:')) {
      if (currentKey !== null) {
        setMetadataField(metadata, currentKey, currentValue.trim());
      }
      currentKey = 'description';
      const value = trimmedLine.slice(12).trim();
      if (value === '>' || value === '|') {
        currentValue = '';
      } else {
        currentValue = value;
      }
    } else if (trimmedLine.startsWith('compatibility:')) {
      if (currentKey !== null) {
        setMetadataField(metadata, currentKey, currentValue.trim());
      }
      currentKey = 'compatibility';
      const value = trimmedLine.slice(14).trim();
      if (value === '>' || value === '|') {
        currentValue = '';
      } else {
        currentValue = value;
      }
    } else if (currentKey !== null && (line.startsWith('  ') || line.startsWith('\t'))) {
      currentValue += ' ' + trimmedLine;
    }
  }

  if (currentKey !== null) {
    setMetadataField(metadata, currentKey, currentValue.trim());
  }

  if (metadata.name === '') {
    throw new Error('SKILL.md frontmatter must include "name" field');
  }

  if (metadata.description === '') {
    throw new Error('SKILL.md frontmatter must include "description" field');
  }

  return { metadata, body };
}

function setMetadataField(metadata: SkillMetadata, key: string, value: string): void {
  if (key === 'name') {
    (metadata as { name: string }).name = value;
  } else if (key === 'description') {
    (metadata as { description: string }).description = value;
  } else if (key === 'compatibility') {
    const truncatedValue = value.slice(0, 500);
    (metadata as { compatibility: string }).compatibility = truncatedValue;
  }
}

/**
 * Check if a directory exists.
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a file exists.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Discover and load a single skill from a directory.
 * Skills are knowledge-only documents (no tools).
 */
export async function loadSkill(skillPath: string): Promise<SkillDefinition | null> {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  const exists = await fileExists(skillMdPath);

  if (!exists) {
    return null;
  }

  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');
    const { metadata, body } = parseFrontmatter(content);
    const id = path.basename(skillPath);

    const skill: SkillDefinition = {
      id,
      path: skillPath,
      metadata,
      body,
    };

    return skill;
  } catch (err) {
    const message = extractErrorMessage(err);
    console.error(`Failed to load skill from ${skillPath}: ${message}`);
    return null;
  }
}

/**
 * Discover all skills in a directory.
 * Each subdirectory containing SKILL.md is treated as a skill.
 */
export async function discoverSkills(skillsDir: string): Promise<SkillDefinition[]> {
  const exists = await directoryExists(skillsDir);

  if (!exists) {
    return [];
  }

  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  const skills: SkillDefinition[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillPath = path.join(skillsDir, entry.name);
    const skill = await loadSkill(skillPath);

    if (skill !== null) {
      skills.push(skill);
    }
  }

  return skills;
}
