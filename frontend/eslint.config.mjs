// ESLint 9 flat config — enforces structural rules Biome cannot:
// max-lines, max-lines-per-function, max-params, max-depth, complexity,
// explicit return types, no-await-in-loop, and React hook discipline.
//
// Biome handles: formatting, naming conventions, no-any, no-nested-ternary,
// exhaustive deps, no-delete, no-accumulating-spread.
// ESLint handles: everything below that requires AST traversal + type info.

import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { dirname } from 'path';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'url';

const Dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  // ── Ignore patterns ────────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      '.intlayer/**',
      'storybook-static/**',
      '**/*.config.{js,mjs,cjs,ts}',
      'next-env.d.ts',
      // Node dev tooling (plain .mjs, outside the TS project); Biome still checks it.
      'scripts/**',
      // The service worker is plain browser JS outside the TS project; Biome still checks it.
      'public/sw.js',
      // Generated from packages/contracts by scripts/sync-contracts.mjs.
      'app/lib/contracts/**',
    ],
  },

  // ── Base ruleset ───────────────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript: strict (no type-checking pass — use tsc for that) ─────────
  ...tseslint.configs.strict,

  // ── Language options ───────────────────────────────────────────────────────
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        // Type-aware rules (no-floating-promises, await-thenable, etc.)
        project: true,
        tsconfigRootDir: Dirname,
      },
    },
  },

  // ── Core structural rules (the ones Biome cannot enforce) ─────────────────
  {
    rules: {
      // ── File / function size ─────────────────────────────────────────────
      // Fat files are a sign of missing module decomposition.
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],

      // 40 lines per function forces extraction into hooks and helpers.
      'max-lines-per-function': [
        'warn',
        // biome-ignore lint/style/useNamingConvention: ESLint config property name
        { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],

      // More than 3 parameters is a sign of missing abstraction (use an options object).
      'max-params': ['warn', { max: 3 }],

      // Nesting beyond 3 levels is unreadable; use early returns and helpers.
      'max-depth': ['warn', { max: 3 }],

      // Cyclomatic complexity — mirrors biome's cognitive complexity limit.
      complexity: ['warn', { max: 6 }],

      // ── Async discipline ─────────────────────────────────────────────────
      // await in a loop serializes parallel work; extract to Promise.all or a service.
      'no-await-in-loop': 'warn',

      // ── Console hygiene ──────────────────────────────────────────────────
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],

      // ── TypeScript: explicit types ───────────────────────────────────────
      // Every exported function must declare its return type explicitly.
      // This is the single most important rule Biome cannot enforce.
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],

      // Public API surface of modules must have explicit types.
      '@typescript-eslint/explicit-module-boundary-types': 'warn',

      // Floating promises are silent bugs — always handle or void explicitly.
      '@typescript-eslint/no-floating-promises': 'warn',

      // Awaiting a non-Promise is always a bug.
      '@typescript-eslint/await-thenable': 'error',

      // Misused promises (e.g. if (asyncFn()) {}) are silent bugs.
      '@typescript-eslint/no-misused-promises': [
        'warn',
        { checksVoidReturn: { attributes: false } },
      ],

      // Force typed arrays, maps, records over unsafe `{}` return types.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // ── Unused code ──────────────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Override base rule — TS version handles overloads correctly.
      'no-unused-vars': 'off',
    },
  },

  // ── React Hooks rules ──────────────────────────────────────────────────────
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Hooks must be called unconditionally and only inside components/hooks.
      'react-hooks/rules-of-hooks': 'error',

      // Missing deps = stale closures = silent bugs.
      // (Biome also enforces this, belt-and-suspenders.)
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // ── TSX / component files — tighter limits ─────────────────────────────────
  {
    files: ['**/*.tsx'],
    rules: {
      // Components are stricter: 30 lines forces extraction into subcomponents.
      'max-lines-per-function': [
        'warn',
        // biome-ignore lint/style/useNamingConvention: ESLint config property name
        { max: 30, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],

      // Components must not take more than 2 props inline — use a Props type.
      // (This counts function params, not object keys inside the props type.)
      'max-params': ['warn', { max: 1 }],

      // MUI 7's Switch overwrites `inputProps` with its own `slotProps.input`
      // ({ role: 'switch' }), so an aria-label passed there never reaches the input.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='Switch'] > JSXAttribute[name.name='inputProps']",
          message:
            "MUI's Switch drops `inputProps`; pass input attributes through `slotProps={{ input: { ... } }}`.",
        },
      ],
    },
  },

  // ── Test files — relax structural rules ───────────────────────────────────
  {
    files: [
      '**/*.spec.{ts,tsx}',
      '**/*.test.{ts,tsx}',
      '**/@tests/**/*.{ts,tsx}',
      // Тестовые хелперы не заканчиваются на .test.tsx, но подчиняются тем же правилам.
      'app/test/**/*.{ts,tsx}',
    ],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-params': 'off',
      'no-await-in-loop': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
);
