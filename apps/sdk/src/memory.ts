import * as fs from 'fs/promises';
import * as path from 'path';

export const MEMORY_SOFT_LIMIT = 200;

export function memoryPath(agentDir?: string): string {
  const dir = agentDir ?? process.cwd();
  const filePath = path.join(dir, 'MEMORY.md');
  return filePath;
}

/**
 * Memory as a directory used to stored memory by topic
 */
export function memoryDir(agentDir?: string): string {
  const dir = agentDir ?? process.cwd();
  return path.join(dir, 'memory');
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

export async function loadMemoryByTopic(topicFileName: string, agentDir?: string): Promise<string> {
  const dir = memoryDir(agentDir);
  const filePath = path.join(dir, topicFileName);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch {
    return '';
  }
}

export async function saveMemoryByTopic(
  topicFileName: string,
  content: string,
  agentDir?: string,
): Promise<void> {
  const dir = memoryDir(agentDir);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, topicFileName);
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
