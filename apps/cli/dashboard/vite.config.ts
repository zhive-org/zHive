import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, '../dist/dashboard'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:7878',
      '/healthz': 'http://127.0.0.1:7878',
    },
  },
});
