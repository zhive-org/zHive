import { join } from 'path';
import * as fs from 'fs/promises';

export function memoryDir(agentDir?: string): string {
  const dir = agentDir ?? process.cwd();
  return join(dir, 'memory');
}

export async function loadMemory(fileName: string, agentDir?: string): Promise<string> {
  const dir = memoryDir(agentDir);
  const filePath = join(dir, fileName);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch {
    return '';
  }
}

export async function saveMemory(
  fileName: string,
  content: string,
  agentDir?: string,
): Promise<void> {
  const dir = memoryDir(agentDir);
  await fs.mkdir(dir, { recursive: true });
  const filePath = join(dir, fileName);
  await fs.writeFile(filePath, content, 'utf-8');
}
