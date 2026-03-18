import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Atomic write: write to a temp file in the same directory, then rename.
 * rename() is atomic on POSIX; on Windows it is best-effort (not guaranteed atomic).
 */
export async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.${crypto.randomBytes(4).toString('hex')}.tmp`,
  );
  await fs.writeFile(tmpPath, data, 'utf-8');
  try {
    await fs.rename(tmpPath, filePath);
  } catch (error: unknown) {
    await fs.unlink(tmpPath).catch(() => {});
    throw error;
  }
}
