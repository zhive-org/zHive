import { describe, it, expect, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { parseFrontmatter, discoverSkills, loadSkill } from './skill-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '../../../../__fixtures__/mock-hive');

function getFixturePath(...segments: string[]): string {
  return path.join(FIXTURES_DIR, ...segments);
}

describe('parseFrontmatter', () => {
  it('parses valid frontmatter with name and description', () => {
    const content = `---
name: test-skill
description: A test skill for testing
---
Body content here.`;

    const result = parseFrontmatter(content);

    expect(result.metadata.name).toBe('test-skill');
    expect(result.metadata.description).toBe('A test skill for testing');
    expect(result.body).toBe('Body content here.');
  });

  it('parses multiline description using YAML block indicator', () => {
    const content = `---
name: multi-line-skill
description: >
  This is a multiline
  description that spans
  multiple lines
---
Skill instructions here.`;

    const result = parseFrontmatter(content);

    expect(result.metadata.name).toBe('multi-line-skill');
    expect(result.metadata.description).toContain('This is a multiline');
    expect(result.metadata.description).toContain('description that spans');
    expect(result.body).toBe('Skill instructions here.');
  });

  it('parses compatibility field when present', () => {
    const content = `---
name: compat-skill
description: Skill with compatibility
compatibility: Requires Node 18+
---
Body.`;

    const result = parseFrontmatter(content);

    expect(result.metadata.name).toBe('compat-skill');
    expect(result.metadata.description).toBe('Skill with compatibility');
    expect(result.metadata.compatibility).toBe('Requires Node 18+');
  });

  it('truncates compatibility to 500 characters', () => {
    const longCompat = 'x'.repeat(600);
    const content = `---
name: long-compat
description: Test
compatibility: ${longCompat}
---
Body.`;

    const result = parseFrontmatter(content);

    expect(result.metadata.compatibility?.length).toBe(500);
  });

  it('throws error when frontmatter does not start with ---', () => {
    const content = `name: invalid
description: No opening delimiter
---
Body.`;

    expect(() => parseFrontmatter(content)).toThrow('must start with YAML frontmatter');
  });

  it('throws error when frontmatter is not closed', () => {
    const content = `---
name: unclosed
description: Missing closing delimiter
Body.`;

    expect(() => parseFrontmatter(content)).toThrow('not closed');
  });

  it('throws error when name field is missing', () => {
    const content = `---
description: Missing name
---
Body.`;

    expect(() => parseFrontmatter(content)).toThrow('must include "name" field');
  });

  it('throws error when description field is missing', () => {
    const content = `---
name: no-description
---
Body.`;

    expect(() => parseFrontmatter(content)).toThrow('must include "description" field');
  });

  it('handles empty body content', () => {
    const content = `---
name: empty-body
description: Skill with no body
---`;

    const result = parseFrontmatter(content);

    expect(result.metadata.name).toBe('empty-body');
    expect(result.body).toBe('');
  });

  it('handles whitespace around content', () => {
    const content = `
---
name: whitespace-skill
description: Handles whitespace
---

  Body with whitespace.
`;

    const result = parseFrontmatter(content);

    expect(result.metadata.name).toBe('whitespace-skill');
    expect(result.body).toBe('Body with whitespace.');
  });
});

describe('discoverSkills', () => {
  it('returns empty array for non-existent directory', async () => {
    const nonExistentPath = getFixturePath('agents', 'non-existent', 'skills');

    const result = await discoverSkills(nonExistentPath);

    expect(result).toEqual([]);
  });

  it('returns empty array for empty skills directory', async () => {
    const emptySkillsPath = getFixturePath('agents', 'empty-agent', 'skills');

    const result = await discoverSkills(emptySkillsPath);

    expect(result).toEqual([]);
  });

  it('returns empty array for agent without skills directory', async () => {
    const noSkillsDirPath = getFixturePath('agents', 'agent-no-skills', 'skills');

    const result = await discoverSkills(noSkillsDirPath);

    expect(result).toEqual([]);
  });

  it('discovers valid skills from subdirectories', async () => {
    const skillsPath = getFixturePath('agents', 'test-agent', 'skills');

    const result = await discoverSkills(skillsPath);

    expect(result).toHaveLength(2);

    const skillIds = result.map((s) => s.id).sort();
    expect(skillIds).toEqual(['skill-with-compat', 'valid-skill']);
  });

  it('loads skill metadata correctly', async () => {
    const skillsPath = getFixturePath('agents', 'test-agent', 'skills');

    const result = await discoverSkills(skillsPath);

    const validSkill = result.find((s) => s.id === 'valid-skill');
    expect(validSkill).toBeDefined();
    expect(validSkill?.metadata.name).toBe('Valid Skill');
    expect(validSkill?.metadata.description).toBe('A valid test skill for testing');
    expect(validSkill?.body).toBe('This is the body content of the valid skill.');
  });

  it('loads skill with compatibility field', async () => {
    const skillsPath = getFixturePath('agents', 'test-agent', 'skills');

    const result = await discoverSkills(skillsPath);

    const compatSkill = result.find((s) => s.id === 'skill-with-compat');
    expect(compatSkill).toBeDefined();
    expect(compatSkill?.metadata.name).toBe('Skill With Compatibility');
    expect(compatSkill?.metadata.description).toBe('A skill that has compatibility requirements');
    expect(compatSkill?.metadata.compatibility).toBe('Requires Node 18+');
  });
});

describe('loadSkill', () => {
  it('returns null when skill directory does not exist', async () => {
    const nonExistentPath = getFixturePath('agents', 'test-agent', 'skills', 'non-existent');

    const result = await loadSkill(nonExistentPath);

    expect(result).toBeNull();
  });

  it('loads and parses valid SKILL.md', async () => {
    const skillPath = getFixturePath('agents', 'test-agent', 'skills', 'valid-skill');

    const result = await loadSkill(skillPath);

    expect(result).not.toBeNull();
    expect(result?.id).toBe('valid-skill');
    expect(result?.path).toBe(skillPath);
    expect(result?.metadata.name).toBe('Valid Skill');
    expect(result?.metadata.description).toBe('A valid test skill for testing');
    expect(result?.body).toBe('This is the body content of the valid skill.');
  });

  it('loads skill with compatibility field', async () => {
    const skillPath = getFixturePath('agents', 'test-agent', 'skills', 'skill-with-compat');

    const result = await loadSkill(skillPath);

    expect(result).not.toBeNull();
    expect(result?.id).toBe('skill-with-compat');
    expect(result?.metadata.name).toBe('Skill With Compatibility');
    expect(result?.metadata.compatibility).toBe('Requires Node 18+');
    expect(result?.body).toBe('This skill has compatibility requirements.');
  });

  it('returns null for directory without SKILL.md', async () => {
    const emptyDirPath = getFixturePath('agents', 'empty-agent', 'skills');

    const result = await loadSkill(emptyDirPath);

    expect(result).toBeNull();
  });

  it('returns null and logs error for invalid frontmatter', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const agentNoSkillsPath = getFixturePath('agents', 'agent-no-skills');

    const result = await loadSkill(agentNoSkillsPath);

    expect(result).toBeNull();

    consoleSpy.mockRestore();
  });
});
