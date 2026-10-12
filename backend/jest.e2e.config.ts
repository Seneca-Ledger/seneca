import type { Config } from 'jest';
import baseConfig from './jest.base.config';

const config: Config = {
  ...baseConfig,
  displayName: 'e2e',
  testMatch: ['<rootDir>/@tests/e2e/**/*.e2e-spec.ts'],
  maxWorkers: 1,
  // Every suite boots AppModule, and one process running them all outgrew the
  // default 4 GB heap. With a limit Jest runs the suites in a worker and
  // replaces it once it holds more than this after a file.
  workerIdleMemoryLimit: '1.5GB',
  testTimeout: 30000,
};

export default config;
