import { defineConfig } from 'tsup';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  tsconfig: 'tsconfig.build.json',
  platform: 'node',
  clean: true,
  splitting: false,
  sourcemap: false,
  treeshake: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  define: {
    'process.env.__CLI_VERSION__': JSON.stringify(pkg.version),
  },
  external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})],
  esbuildOptions(options) {
    options.jsxImportSource = 'react';
  },
});
