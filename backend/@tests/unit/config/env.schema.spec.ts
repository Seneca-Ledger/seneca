import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { parse } from 'dotenv';
import { validateEnv } from '@/config/env.schema';

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://seneca:s3cret-pass@db:5432/seneca',
  REDIS_URL: 'redis://redis:6379/0',
  PORT: '3001',
  JWT_SECRET: 'jwt',
  JWT_REFRESH_SECRET: 'refresh',
  INTEGRATIONS_ENCRYPTION_KEY: 'key',
};

describe('validateEnv', () => {
  it('accepts a complete production environment and returns it untouched', () => {
    const config = { ...production, SOMETHING_ELSE: 'kept' };
    expect(validateEnv(config)).toBe(config);
  });

  it('lets development run on defaults', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => validateEnv({})).not.toThrow();
    expect(() => validateEnv({ REDIS_URL: '', PORT: '' })).not.toThrow();
  });

  it('accepts the shipped .env.example', () => {
    const example = parse(readFileSync(path.join(process.cwd(), '.env.example')));
    expect(() => validateEnv(example)).not.toThrow();
  });

  it('refuses production without its secrets, listing every missing one', () => {
    const { JWT_SECRET, INTEGRATIONS_ENCRYPTION_KEY, DATABASE_URL, ...rest } = production;
    expect(() => validateEnv({ ...rest, JWT_REFRESH_SECRET: '  ' })).toThrow(
      /DATABASE_URL[\s\S]*JWT_SECRET[\s\S]*JWT_REFRESH_SECRET: must not be empty[\s\S]*INTEGRATIONS_ENCRYPTION_KEY/,
    );
  });

  it('checks formats in every environment', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', REDIS_URL: 'localhost:6379' })).toThrow(
      'REDIS_URL: must be a redis:// URL',
    );
    expect(() => validateEnv({ PORT: 'abc' })).toThrow('PORT: must be a port number');
  });

  it('never echoes a value into the error', () => {
    const leaky = 'mysql://root:hunter2@db/seneca';
    let message = '';
    try {
      validateEnv({ ...production, DATABASE_URL: leaky, JWT_SECRET: '' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('DATABASE_URL: must be a postgres:// URL');
    expect(message).not.toContain('hunter2');
  });
});
