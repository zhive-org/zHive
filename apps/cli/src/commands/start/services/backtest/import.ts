import fs from 'fs-extra';
import { z } from 'zod';
import type { BacktestThread, BacktestImportFile, BacktestImportThread } from './types.js';
import { extractErrorMessage } from '../../../../shared/agent/utils.js';
import type { Result } from '../../../../shared/types.js';

/**
 * Schema for validating imported JSON file.
 */
const citationSchema = z.object({
  url: z.string().optional(),
  title: z.string(),
});

const importThreadSchema = z.object({
  project_id: z.string().min(1, 'project_id is required'),
  project_name: z.string().min(1, 'project_name is required'),
  text: z.string().min(1, 'text is required'),
  timestamp: z.string().optional(),
  price_on_fetch: z.number().positive('price_on_fetch must be positive'),
  price_on_eval: z.number().positive('price_on_eval must be positive'),
  project_symbol: z.string().optional(),
  project_categories: z.array(z.string()).optional(),
  project_description: z.string().optional(),
  citations: z.array(citationSchema).optional(),
});

const importFileSchema = z.object({
  name: z.string().optional(),
  threads: z.array(importThreadSchema).min(1, 'At least one thread is required'),
});

export type ImportResult = Result<{ name?: string; threads: BacktestThread[] }>;

/**
 * Import and validate a backtest JSON file.
 */
export async function importBacktestFile(filePath: string): Promise<ImportResult> {
  // Check if file exists
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  // Read file content
  let content: unknown;
  try {
    content = await fs.readJson(filePath);
  } catch (err) {
    const message = extractErrorMessage(err);
    return { success: false, error: `Failed to parse JSON: ${message}` };
  }

  // Validate structure
  const parseResult = importFileSchema.safeParse(content);
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    return { success: false, error: `Validation failed: ${issues}` };
  }

  const importData = parseResult.data as BacktestImportFile;

  // Convert to BacktestThread format
  const threads = importData.threads.map((t) => convertImportThread(t));

  return {
    success: true,
    data: {
      name: importData.name,
      threads,
    },
  };
}

/**
 * Convert an import thread to a BacktestThread.
 */
function convertImportThread(input: BacktestImportThread): BacktestThread {
  const thread: BacktestThread = {
    project_id: input.project_id,
    project_name: input.project_name,
    project_symbol: input.project_symbol,
    project_categories: input.project_categories,
    project_description: input.project_description,
    text: input.text,
    timestamp: input.timestamp ?? new Date().toISOString(),
    price_on_fetch: input.price_on_fetch,
    price_on_eval: input.price_on_eval,
    citations: input.citations ?? [],
  };

  return thread;
}

/**
 * Validate a single thread input (for interactive mode).
 */
export function validateThreadInput(input: Partial<BacktestImportThread>): string[] {
  const errors: string[] = [];

  if (!input.project_id || input.project_id.trim() === '') {
    errors.push('project_id is required');
  }

  if (!input.project_name || input.project_name.trim() === '') {
    errors.push('project_name is required');
  }

  if (!input.text || input.text.trim() === '') {
    errors.push('text is required');
  }

  if (typeof input.price_on_fetch !== 'number' || input.price_on_fetch <= 0) {
    errors.push('price_on_fetch must be a positive number');
  }

  if (typeof input.price_on_eval !== 'number' || input.price_on_eval <= 0) {
    errors.push('price_on_eval must be a positive number');
  }

  return errors;
}

/**
 * Create a BacktestThread from validated input.
 */
export function createThread(input: BacktestImportThread): BacktestThread {
  return convertImportThread(input);
}
