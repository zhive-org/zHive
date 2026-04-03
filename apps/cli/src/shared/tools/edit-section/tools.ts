import { tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { extractErrorMessage } from '../../agent/utils';

export function replaceSection(fileContent: string, heading: string, newContent: string): string {
  const lines = fileContent.split('\n');
  const headingLine = `## ${heading}`;

  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === headingLine) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) {
    throw new Error(`Section "## ${heading}" not found in file.`);
  }

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      endIdx = i;
      break;
    }
  }

  const before = lines.slice(0, startIdx + 1);
  const after = lines.slice(endIdx);
  const trimmedContent = newContent.trim();
  const newSection = ['', ...trimmedContent.split('\n'), ''];

  const result = [...before, ...newSection, ...after].join('\n');
  return result;
}

export const editSectionTool = tool({
  description: 'Edit a section of SOUL.md or STRATEGY.md. Only call AFTER user confirms.',
  inputSchema: z.object({
    file: z.enum(['SOUL.md', 'STRATEGY.md']),
    section: z.string().describe('Exact ## heading name, e.g. "Personality", "Conviction Style"'),
    content: z.string().describe('New content for the section (without the ## heading line)'),
  }),
  execute: async ({ file, section, content }) => {
    const filePath = path.join(process.cwd(), file);
    let fileContent: string;
    try {
      fileContent = await fs.readFile(filePath, 'utf-8');
    } catch {
      return `Error: ${file} not found in current directory.`;
    }
    try {
      const updated = replaceSection(fileContent, section, content);
      await fs.writeFile(filePath, updated, 'utf-8');
      return `Updated "${section}" section in ${file}.`;
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      return `Error: ${message}`;
    }
  },
});
