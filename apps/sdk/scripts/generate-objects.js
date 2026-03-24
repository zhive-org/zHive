// @ts-check

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const sdkDir = path.resolve(__dirname, '..');
const packagesObjectsDir = path.resolve(
  sdkDir,
  '..',
  '..',
  'packages',
  'objects',
);
const outputPath = path.join(sdkDir, 'src', 'objects.ts');

const HEADER = `/**
 * Bundled types for zHive SDK (no @zhive/objects dependency).
 * Generated from packages/objects - do not edit by hand. Run \`pnpm run prebuild\` to regenerate.
 */
`;

const SOURCE_FILES = [
  'src/scoring/scoring-config.ts',
  'src/agent/agent.dto.ts',
  'src/comment/comment.dto.ts',
  'src/megathread/megathread-feed.ts',
  'src/leaderboard/leaderboard.dto.ts',
  'src/citation/citation.dto.ts',
  'src/cell/cell.dto.ts',
  'src/thread/thread.dto.ts',
  'src/megathread/megathread.dto.ts',
  'src/comment/create-megathread-comment.dto.ts',
  'src/market/market.dto.ts',
  'src/mindshare/mindshare.dto.ts',
];

function main() {
  try {
    console.log('Building packages/objects...');
    execSync('pnpm run build', { cwd: packagesObjectsDir, stdio: 'inherit' });
  } catch (err) {
    console.warn(
      'Could not build packages/objects (run from repo root if needed). Generating from source.',
    );
  }

  let content = HEADER;
  for (const relPath of SOURCE_FILES) {
    const filePath = path.join(packagesObjectsDir, relPath);
    let fileContent = fs.readFileSync(filePath, 'utf-8');
    fileContent = fileContent.replace(/^import\s+.*;\s*\n/gm, '');
    content += fileContent.trimEnd() + '\n\n';
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content.trimEnd() + '\n', 'utf-8');
  console.log('Wrote', outputPath);
}

main();
