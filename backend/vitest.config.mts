import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Nest DI, TypeORM and class-validator read decorator metadata, which Vite's own
// transform does not emit: SWC compiles the TypeScript the way tsc builds it
// (legacy decorators with design:type metadata, class fields assigned rather than
// defined). Relation properties are typed Relation<T> so their metadata does not
// name the related class across circular entity imports.
const swcPlugin = swc.vite({
  jsc: {
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true, useDefineForClassFields: false },
    target: 'es2022',
    keepClassNames: true,
  },
});

// __dirname is not defined in an ESM config.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const shared = {
  plugins: [swcPlugin],
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${path.resolve(__dirname, 'src')}/` },
      // The app is CommonJS (tsc) and gets xlsx's CJS build, which writes files
      // through fs; its ESM build (what Vite would pick) has no fs without set_fs.
      { find: /^xlsx$/, replacement: path.resolve(__dirname, 'node_modules/xlsx/xlsx.js') },
    ],
  },
};

export default defineConfig({
  ...shared,
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['reflect-metadata'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.interface.ts',
        'src/**/index.ts',
        'src/main.ts',
        'src/data-source.ts',
      ],
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcov', 'html'],
      thresholds: { statements: 8, branches: 5, functions: 8, lines: 8 },
    },
    projects: [
      {
        ...shared,
        extends: true,
        test: {
          name: 'unit',
          include: ['@tests/**/*.spec.ts'],
          exclude: ['@tests/e2e/**'],
        },
      },
      {
        ...shared,
        extends: true,
        test: {
          // Real statement PDFs; runs only with GOLDEN_ENABLED=1 (npm run test:golden).
          name: 'golden',
          include: ['src/modules/parsing/__tests__/parsing.golden.spec.ts'],
        },
      },
      {
        ...shared,
        extends: true,
        test: {
          name: 'e2e',
          include: ['@tests/e2e/**/*.e2e-spec.ts'],
          setupFiles: ['@tests/e2e/helpers/vitest-setup.ts'],
          // Every suite boots AppModule against one database: one file at a time.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
