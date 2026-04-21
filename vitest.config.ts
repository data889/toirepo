import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// happy-dom is required from M7 P2.1 onwards — primitive component
// tests use @testing-library/react which needs a DOM. happy-dom adds
// ~50ms cold start over `environment: 'node'` for the legacy logic
// tests too; acceptable tradeoff for a single-env config.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/unit/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    env: {
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
