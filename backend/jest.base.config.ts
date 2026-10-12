import type { Config } from 'jest';

const baseConfig: Config = {
  testEnvironment: 'node',
  rootDir: '.',
  cache: true,
  setupFiles: ['reflect-metadata'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
  transform: {
    '^.+\\.(t|j)sx?$': ['babel-jest', { rootMode: 'upward' }],
  },
  // otplib and its crypto/base32 plugins and effect ship ESM only, so they need transforming too.
  transformIgnorePatterns: ['/node_modules/(?!(otplib|@otplib|@scure|@noble|effect|@effect)/)'],
};

export default baseConfig;
