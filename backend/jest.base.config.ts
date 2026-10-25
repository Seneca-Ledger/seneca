import type { Config } from 'jest';
import * as path from 'path';

const baseConfig: Config = {
  testEnvironment: 'node',
  rootDir: '.',
  cache: true,
  setupFiles: ['reflect-metadata'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Exported for `import` only; Jest resolves it as `require`.
    '^unpdf/pdfjs$': '<rootDir>/node_modules/unpdf/dist/pdfjs.mjs',
  },
  clearMocks: true,
  transform: {
    // Already-compiled ESM packages need only ESM -> CommonJS. The app config
    // (legacy decorators) would lower their classes and choke on static blocks,
    // and takes ~6 s on unpdf's 1.7 MB pdf.js bundle, past Jest's 5 s timeout.
    '/node_modules/(unpdf|@nestjs)/.+\\.[cm]?js$': [
      'babel-jest',
      {
        configFile: false,
        babelrc: false,
        compact: true,
        plugins: [
          path.join(__dirname, '@tests/support/babel-esm-to-cjs.js'),
          '@babel/plugin-transform-modules-commonjs',
          '@babel/plugin-transform-dynamic-import',
        ],
      },
    ],
    '^.+\\.(t|j)sx?$': ['babel-jest', { rootMode: 'upward' }],
  },
  // otplib and its crypto/base32 plugins and effect ship ESM only, so they need transforming too;
  // unpdf loads its pdf.js bundle (ESM) with import(), which CommonJS Jest cannot run untransformed;
  // @nestjs/* ship ESM from v12 (the app itself loads them through Node's require(esm)).
  transformIgnorePatterns: [
    '/node_modules/(?!(otplib|@otplib|@scure|@noble|effect|@effect|unpdf|@nestjs)/)',
  ],
};

export default baseConfig;
