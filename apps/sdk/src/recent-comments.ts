import * as fs from 'fs/promises';
import * as path from 'path';
import { atomicWriteFile } from './fs-utils';

export interface StoredRecentComment {
  threadId: string;
  prediction: string;
  call?: 'up' | 'down';
}

export function recentCommentsPath(agentDir?: string): string {
  const dir = agentDir ?? process.cwd();
  const filePath = path.join(dir, 'recent-comments.json');
  return filePath;
}

export async function loadRecentComments(agentDir?: string): Promise<StoredRecentComment[]> {
  const filePath = recentCommentsPath(agentDir);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as StoredRecentComment[];
    if (Array.isArray(data)) {
      return data;
    }
  } catch {
    // File missing or invalid
  }
  return [];
}

export async function saveRecentComments(
  comments: StoredRecentComment[],
  agentDir?: string,
): Promise<void> {
  const filePath = recentCommentsPath(agentDir);
  await atomicWriteFile(filePath, JSON.stringify(comments, null, 2));
}
