import { defineConfig } from 'vitest/config'

// Relative base so the same build works at the domain root and under a
// GitHub Pages project subpath (/<repo>/) without rebuilding.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  test: { environment: 'node' },
})
