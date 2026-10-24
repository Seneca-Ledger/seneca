import type { Config } from 'jest';
import * as path from 'path';

// Already-compiled ESM packages Jest has to turn into CommonJS. They need only
// that: the app's Babel config (legacy decorators) would lower their classes
// and choke on static blocks, and takes ~6 s on unpdf's 1.7 MB pdf.js bundle,
// past Jest's 5 s test timeout. @nestjs/* ship ESM from v12 (the app itself
// loads them through Node's require(esm)); unpdf loads pdf.js with import().
const ESM_PACKAGES = [
  '@nestjs',
  'unpdf',
  'archiver',
  'zip-stream',
  'compress-commons',
  'crc32-stream',
  'is-stream',
  '@scure',
  '@noble',
].join('|');

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
    [`/node_modules/(${ESM_PACKAGES})/.+\\.[cm]?js$`]: [
      'babel-jest',
      {
        configFile: false,
        babelrc: false,
        compact: true,
        // CommonJS files of these packages (or their deps) stay as they are.
        sourceType: 'unambiguous',
        plugins: [
          path.join(__dirname, '@tests/support/babel-esm-to-cjs.js'),
          '@babel/plugin-transform-modules-commonjs',
          '@babel/plugin-transform-dynamic-import',
        ],
      },
    ],
    '^.+\\.(t|j)sx?$': ['babel-jest', { rootMode: 'upward' }],
  },
  // otplib and its crypto/base32 plugins and effect ship ESM only, so they need transforming too
  // (with the app's config, above), as do ESM_PACKAGES.
  transformIgnorePatterns: [`/node_modules/(?!(otplib|@otplib|effect|@effect|${ESM_PACKAGES})/)`],
};

export default baseConfig;
