import * as fs from 'fs/promises';
import * as path from 'path';

export const MEMORY_SOFT_LIMIT = 200;

export function memoryPath(agentDir?: string): string {
  const dir = agentDir ?? process.cwd();
  const filePath = path.join(dir, 'MEMORY.md');
  return filePath;
}

export async function loadMemory(agentDir?: string): Promise<string> {
  const filePath = memoryPath(agentDir);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch {
    return '';
  }
}

export async function saveMemory(content: string, agentDir?: string): Promise<void> {
  const filePath = memoryPath(agentDir);
  await fs.writeFile(filePath, content, 'utf-8');
}

export function getMemoryLineCount(content: string): number {
  if (content.length === 0) {
    return 0;
  }
  const lines = content.split('\n');
  const lineCount = content.endsWith('\n') ? lines.length - 1 : lines.length;
  return lineCount;
}
