import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  memoryPath,
  loadMemory,
  saveMemory,
  getMemoryLineCount,
  MEMORY_SOFT_LIMIT,
} from './memory';

describe('memory', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hive-memory-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('MEMORY_SOFT_LIMIT', () => {
    it('should be 200', () => {
      expect(MEMORY_SOFT_LIMIT).toBe(200);
    });
  });

  describe('memoryPath', () => {
    it('should return MEMORY.md in the given directory', () => {
      const result = memoryPath('/some/agent/dir');
      expect(result).toBe('/some/agent/dir/MEMORY.md');
    });

    it('should default to process.cwd() when no directory given', () => {
      const result = memoryPath();
      const expected = path.join(process.cwd(), 'MEMORY.md');
      expect(result).toBe(expected);
    });
  });

  describe('loadMemory', () => {
    it('should return file content when MEMORY.md exists', async () => {
      const content = '# Memory\n\n- learned something';
      await fs.writeFile(path.join(tmpDir, 'MEMORY.md'), content, 'utf-8');

      const result = await loadMemory(tmpDir);
      expect(result).toBe(content);
    });

    it('should return empty string when MEMORY.md does not exist', async () => {
      const result = await loadMemory(tmpDir);
      expect(result).toBe('');
    });
  });

  describe('saveMemory', () => {
    it('should write content to MEMORY.md', async () => {
      const content = '# Memory\n\n- new learning';
      await saveMemory(content, tmpDir);

      const written = await fs.readFile(path.join(tmpDir, 'MEMORY.md'), 'utf-8');
      expect(written).toBe(content);
    });

    it('should overwrite existing MEMORY.md', async () => {
      await fs.writeFile(path.join(tmpDir, 'MEMORY.md'), 'old content', 'utf-8');
      const newContent = '# Memory\n\n- updated';
      await saveMemory(newContent, tmpDir);

      const written = await fs.readFile(path.join(tmpDir, 'MEMORY.md'), 'utf-8');
      expect(written).toBe(newContent);
    });
  });

  describe('getMemoryLineCount', () => {
    it('should return 0 for empty string', () => {
      const result = getMemoryLineCount('');
      expect(result).toBe(0);
    });

    it('should return 1 for single line', () => {
      const result = getMemoryLineCount('# Memory');
      expect(result).toBe(1);
    });

    it('should count lines correctly', () => {
      const content = '# Memory\n\n- line 1\n- line 2\n- line 3';
      const result = getMemoryLineCount(content);
      expect(result).toBe(5);
    });

    it('should not count trailing newline as an extra line', () => {
      const content = '# Memory\n';
      const result = getMemoryLineCount(content);
      expect(result).toBe(1);
    });
  });
});
