import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Prisma-generated client: ships with require()-style internals
    // and unused runtime helpers that our rules don't apply to.
    'src/generated/**',
  ]),
  // Allow underscore-prefixed params/vars as an explicit "unused on purpose"
  // signal. Used e.g. in canAutoPublish(_user) where the function will read
  // the arg in a later milestone (V1.0 trusted-user logic) but deliberately
  // ignores it during MVP.
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
])

export default eslintConfig
