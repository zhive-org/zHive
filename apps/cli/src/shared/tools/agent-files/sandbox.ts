import * as fs from 'fs/promises';
import * as path from 'path';

const ALLOWED_EXTENSIONS = new Set(['.md', '.json', '.jsonl', '.txt', '.yaml', '.yml']);
const MAX_BYTES = 64 * 1024;

const ENV_RE = /^\.env(\..+)?$/i;

export async function resolveAgentPath(
  agentDir: string,
  requestedPath: string,
): Promise<string> {
  const agentReal = await fs.realpath(agentDir);
  const joined = path.resolve(agentDir, requestedPath);
  // realpath may fail if the file doesn't exist yet; fall back to the
  // resolved path for the prefix check, then let readFile surface ENOENT.
  let candidate: string;
  try {
    candidate = await fs.realpath(joined);
  } catch {
    candidate = joined;
  }
  const prefix = agentReal.endsWith(path.sep) ? agentReal : agentReal + path.sep;
  if (candidate !== agentReal && !candidate.startsWith(prefix)) {
    throw new Error('path escapes agent directory');
  }
  return candidate;
}

export function assertReadable(filename: string): void {
  const lower = filename.toLowerCase();
  if (lower === 'config.json') {
    throw new Error('access denied: config.json contains credentials');
  }
  if (ENV_RE.test(filename)) {
    throw new Error('access denied: env files are off-limits');
  }
  if (lower.includes('secret') || lower.includes('credential')) {
    throw new Error('access denied: filename suggests credentials');
  }
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `extension not allowed: only ${[...ALLOWED_EXTENSIONS].join(', ')} files can be read`,
    );
  }
}

export async function readWithCap(
  absPath: string,
): Promise<{ content: string; truncated: boolean }> {
  const handle = await fs.open(absPath, 'r');
  try {
    const stat = await handle.stat();
    const size = stat.size;
    const toRead = Math.min(size, MAX_BYTES);
    const buf = Buffer.alloc(toRead);
    await handle.read(buf, 0, toRead, 0);
    return {
      content: buf.toString('utf-8'),
      truncated: size > MAX_BYTES,
    };
  } finally {
    await handle.close();
  }
}
