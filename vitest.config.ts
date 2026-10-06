import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts, whose root is one site's sites/<site>/ folder;
// tests run from the repo root across all three sites.
export default defineConfig({
  test: {},
})
