import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { fetchSkills, formatSkills, skillsSlashCommand } from './skills';
import type { SkillDefinition } from '../../../shared/agent/skills/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

vi.mock('../../../shared/config/constant', () => ({
  getHiveDir: vi.fn(() => path.join(__dirname, '../../../../__fixtures__/mock-hive')),
}));

function createMockSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
  const skill: SkillDefinition = {
    id: 'test-skill',
    path: '/mock/.hive/agents/test-agent/skills/test-skill',
    metadata: {
      name: 'Test Skill',
      description: 'A test skill description',
    },
    body: 'Skill body content',
    ...overrides,
  };
  return skill;
}

describe('formatSkills', () => {
  it('returns no skills message for empty array', () => {
    const result = formatSkills([]);

    expect(result).toContain('No skills loaded');
    expect(result).toContain('skills/ directory');
  });

  it('formats a single skill correctly', () => {
    const skills = [createMockSkill()];

    const result = formatSkills(skills);

    expect(result).toContain('Available Skills');
    expect(result).toContain('Test Skill');
    expect(result).toContain('A test skill description');
  });

  it('includes compatibility information when present', () => {
    const skillWithCompat = createMockSkill({
      metadata: {
        name: 'Compat Skill',
        description: 'Skill with compatibility',
        compatibility: 'Requires Node 18+',
      },
    });
    const skills = [skillWithCompat];

    const result = formatSkills(skills);

    expect(result).toContain('Compat Skill');
    expect(result).toContain('Skill with compatibility');
    expect(result).toContain('Requires Node 18+');
  });

  it('formats multiple skills correctly', () => {
    const skills = [
      createMockSkill({
        id: 'skill-1',
        metadata: { name: 'First Skill', description: 'First description' },
      }),
      createMockSkill({
        id: 'skill-2',
        metadata: { name: 'Second Skill', description: 'Second description' },
      }),
    ];

    const result = formatSkills(skills);

    expect(result).toContain('First Skill');
    expect(result).toContain('First description');
    expect(result).toContain('Second Skill');
    expect(result).toContain('Second description');
  });
});

describe('fetchSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for non-existent agent', async () => {
    const result = await fetchSkills('non-existent-agent');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('returns empty array for agent with empty skills directory', async () => {
    const result = await fetchSkills('empty-agent');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('returns discovered skills successfully', async () => {
    const result = await fetchSkills('test-agent');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);

      const skillIds = result.data.map((s) => s.id).sort();
      expect(skillIds).toEqual(['skill-with-compat', 'valid-skill']);
    }
  });

  it('loads skill metadata correctly', async () => {
    const result = await fetchSkills('test-agent');

    expect(result.success).toBe(true);
    if (result.success) {
      const validSkill = result.data.find((s) => s.id === 'valid-skill');
      expect(validSkill).toBeDefined();
      expect(validSkill?.metadata.name).toBe('Valid Skill');
      expect(validSkill?.metadata.description).toBe('A valid test skill for testing');
    }
  });
});

describe('skillsSlashCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onSuccess with formatted output on success', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await skillsSlashCommand('test-agent', { onSuccess, onError });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toContain('Available Skills');
    expect(onSuccess.mock.calls[0][0]).toContain('Valid Skill');
    expect(onSuccess.mock.calls[0][0]).toContain('Skill With Compatibility');
    expect(onError).not.toHaveBeenCalled();
  });

  it('handles empty skills list', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await skillsSlashCommand('empty-agent', { onSuccess, onError });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toContain('No skills loaded');
    expect(onError).not.toHaveBeenCalled();
  });

  it('works without callbacks', async () => {
    // Should not throw
    await skillsSlashCommand('test-agent', {});
  });

  it('works with agent that has no skills directory', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await skillsSlashCommand('agent-no-skills', { onSuccess, onError });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toContain('No skills loaded');
    expect(onError).not.toHaveBeenCalled();
  });
});
