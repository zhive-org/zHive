import fs from 'fs-extra';
import path from 'path';
import { extractErrorMessage } from '../../shared/agent/utils';

/** Files scaffolded by the old `hive create` that are now in @zhive/cli */
const OLD_FILES = [
  'index.tsx',
  'analysis.ts',
  'prompt.ts',
  'chat-prompt.ts',
  'memory-prompt.ts',
  'edit-section.ts',
  'fetch-rules.ts',
  'helpers.ts',
  'theme.ts',
  'types.ts',
  'process-lifecycle.ts',
  'tsconfig.json',
];

/** Directories scaffolded by the old `hive create` */
const OLD_DIRS = ['hooks', 'components', 'hive'];

export interface MigrateResult {
  name: string;
  success: boolean;
  error?: string;
}

export function isOldStyleAgent(agentDir: string): boolean {
  const indexPath = path.join(agentDir, 'index.tsx');
  return fs.pathExistsSync(indexPath);
}

export async function migrateAgent(
  agentDir: string,
  name: string,
  onStep: (step: string) => void,
): Promise<MigrateResult> {
  try {
    // 1. Verify it's a valid agent
    const soulPath = path.join(agentDir, 'SOUL.md');
    const soulExists = await fs.pathExists(soulPath);
    if (!soulExists) {
      return { name, success: false, error: 'No SOUL.md found — not a valid agent' };
    }

    // 2. Delete old scaffolded files
    onStep('Removing old runtime files');
    for (const file of OLD_FILES) {
      const filePath = path.join(agentDir, file);
      const exists = await fs.pathExists(filePath);
      if (exists) {
        await fs.remove(filePath);
      }
    }

    // 3. Delete old directories
    onStep('Removing old directories');
    for (const dir of OLD_DIRS) {
      const dirPath = path.join(agentDir, dir);
      const exists = await fs.pathExists(dirPath);
      if (exists) {
        await fs.remove(dirPath);
      }
    }

    // 4. Rewrite package.json
    onStep('Rewriting package.json');
    const pkgPath = path.join(agentDir, 'package.json');
    const pkgExists = await fs.pathExists(pkgPath);
    let pkgName = `hive-agent-${name}`;
    if (pkgExists) {
      const oldPkg = await fs.readJson(pkgPath);
      pkgName = oldPkg.name ?? pkgName;
    }

    const newPkg = {
      name: pkgName,
      private: true,
      type: 'module',
      scripts: {
        start: 'npx @zhive/cli@latest start',
      },
    };
    await fs.writeJson(pkgPath, newPkg, { spaces: 2 });

    // 5. Remove old node_modules and lock files (no longer needed)
    onStep('Cleaning up old dependencies');
    const nodeModulesPath = path.join(agentDir, 'node_modules');
    const nodeModulesExists = await fs.pathExists(nodeModulesPath);
    if (nodeModulesExists) {
      await fs.remove(nodeModulesPath);
    }

    const lockPath = path.join(agentDir, 'package-lock.json');
    const lockExists = await fs.pathExists(lockPath);
    if (lockExists) {
      await fs.remove(lockPath);
    }

    return { name, success: true };
  } catch (err: unknown) {
    const message = extractErrorMessage(err);
    return { name, success: false, error: message.slice(0, 200) };
  }
}
