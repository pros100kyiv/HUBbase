import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  {
    // Keep Next.js/React safety rules, but disable the newest "compiler-style"
    // hook lint rules that are too noisy for this codebase right now.
    rules: {
      'react/no-unescaped-entities': 'off',

      // Too noisy with current patterns; doesn't affect runtime correctness.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',

      // Still useful, but we don't want it to fail CI/dev builds.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'tsconfig.tsbuildinfo',
    'public/sw.js', // service worker has different runtime constraints
  ]),
])

