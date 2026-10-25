import type { Config } from 'jest';
import * as path from 'path';

// ESM-only packages Jest has to turn into CommonJS (see swc-esm-transform.js).
// @nestjs/* ship ESM from v12 (the app itself loads them through Node's
// require(esm)); unpdf loads its pdf.js bundle with import().
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
  'otplib',
  '@otplib',
  'effect',
  '@effect',
].join('|');

// The app's TypeScript, compiled the way tsc builds it: legacy decorators with
// their design:type metadata (Nest DI, TypeORM, class-validator) and class
// fields assigned, not defined, so they do not replace what decorators put on
// the prototype. Relation properties are typed Relation<T> so their metadata
// does not touch the related class (circular entity imports).
const APP_SWC = {
  jsc: {
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true, useDefineForClassFields: false },
    target: 'es2022',
    keepClassNames: true,
  },
  module: { type: 'commonjs' },
};

const ESM_TRANSFORM = path.join(__dirname, '@tests/support/swc-esm-transform.js');

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
    // Listed first: Jest takes the first pattern that matches.
    '/node_modules/unpdf/.+\\.[cm]?js$': [ESM_TRANSFORM, { isModule: true }],
    [`/node_modules/(${ESM_PACKAGES})/.+\\.[cm]?js$`]: ESM_TRANSFORM,
    '^.+\\.(t|j)sx?$': ['@swc/jest', APP_SWC],
  },
  transformIgnorePatterns: [`/node_modules/(?!(${ESM_PACKAGES})/)`],
};

export default baseConfig;
