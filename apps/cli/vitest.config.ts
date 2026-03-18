import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 60 * 1000,
    hookTimeout: 60 * 1000,
  },
});
