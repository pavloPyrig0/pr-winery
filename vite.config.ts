import { defineConfig } from 'vitest/config';

// Relative base so the build works on any GitHub Pages path (/<repo>/).
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
