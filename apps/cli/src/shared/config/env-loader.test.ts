import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { updateEnvVar } from './env-loader';

describe('updateEnvVar', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'zhive-env-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates a new .env file when none exists', () => {
    updateEnvVar(dir, 'ANTHROPIC_API_KEY', 'sk-test');
    const filePath = path.join(dir, '.env');
    return readFile(filePath, 'utf-8').then((content) => {
      expect(content).toBe('ANTHROPIC_API_KEY=sk-test');
    });
  });

  it('replaces an existing key in place, preserving other lines', async () => {
    const filePath = path.join(dir, '.env');
    await writeFile(
      filePath,
      ['# comment', 'OPENAI_API_KEY=keep-me', 'ANTHROPIC_API_KEY=old', 'OTHER=value', ''].join(
        '\n',
      ),
    );

    updateEnvVar(dir, 'ANTHROPIC_API_KEY', 'new');
    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('OPENAI_API_KEY=keep-me');
    expect(content).toContain('ANTHROPIC_API_KEY=new');
    expect(content).not.toContain('ANTHROPIC_API_KEY=old');
    expect(content).toContain('OTHER=value');
    expect(content).toContain('# comment');
  });

  it('appends a new key when missing', async () => {
    const filePath = path.join(dir, '.env');
    await writeFile(filePath, 'OPENAI_API_KEY=existing\n');

    updateEnvVar(dir, 'XAI_API_KEY', 'newkey');
    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('OPENAI_API_KEY=existing');
    expect(content).toContain('XAI_API_KEY=newkey');
  });

  it('rejects invalid env var names', () => {
    expect(() => updateEnvVar(dir, 'has-dash', 'x')).toThrow(/Invalid env var name/);
    expect(() => updateEnvVar(dir, '1STARTSWITHNUM', 'x')).toThrow(/Invalid env var name/);
    expect(() => updateEnvVar(dir, 'has space', 'x')).toThrow(/Invalid env var name/);
  });

  it('rejects values with newlines', () => {
    expect(() => updateEnvVar(dir, 'KEY', 'val\nbreak')).toThrow(/cannot contain newlines/);
    expect(() => updateEnvVar(dir, 'KEY', 'val\rbreak')).toThrow(/cannot contain newlines/);
  });

  it('handles values with special characters that are NOT newlines', () => {
    updateEnvVar(dir, 'API_KEY', 'sk-abc=def&ghi/jkl+mno');
    return readFile(path.join(dir, '.env'), 'utf-8').then((content) => {
      expect(content).toContain('API_KEY=sk-abc=def&ghi/jkl+mno');
    });
  });
});
