import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyEnvDefaults,
  buildBackendEnv,
  buildRootEnv,
  detectComposeCommand,
  getMissingNativeCommands,
  getPostgresConnection,
  prepareEnv,
  parseEnv,
  shouldInstallDependencies,
} from './setup-dev.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('buildRootEnv includes Docker dev defaults and generated secrets', () => {
  const env = buildRootEnv({
    jwtSecret: 'jwt-secret',
    jwtRefreshSecret: 'refresh-secret',
    integrationsEncryptionKey: 'integration-secret',
  });

  assert.equal(env.POSTGRES_USER, 'finflow');
  assert.equal(env.POSTGRES_PASSWORD, 'finflow');
  assert.equal(env.POSTGRES_DB, 'finflow');
  assert.equal(env.POSTGRES_PORT, '5434');
  assert.equal(env.REDIS_PORT, '6379');
  assert.equal(env.JWT_SECRET, 'jwt-secret');
  assert.equal(env.JWT_REFRESH_SECRET, 'refresh-secret');
  assert.equal(env.INTEGRATIONS_ENCRYPTION_KEY, 'integration-secret');
});

test('buildBackendEnv points local development at generated infrastructure ports', () => {
  const env = buildBackendEnv({
    jwtSecret: 'jwt-secret',
    jwtRefreshSecret: 'refresh-secret',
    integrationsEncryptionKey: 'integration-secret',
  });

  assert.equal(env.NODE_ENV, 'development');
  assert.equal(env.DATABASE_URL, 'postgresql://finflow:finflow@localhost:5434/finflow');
  assert.equal(env.REDIS_URL, 'redis://localhost:6379');
  assert.equal(env.INTEGRATIONS_ENCRYPTION_KEY, 'integration-secret');
});

test('applyEnvDefaults preserves existing user values and writes missing values', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'seneca-setup-env-'));
  const envPath = path.join(dir, '.env');
  await writeFile(envPath, '# Keep my local notes\nPOSTGRES_PORT=15432\nJWT_SECRET=custom\n');

  const result = await applyEnvDefaults(envPath, {
    POSTGRES_PORT: '5434',
    POSTGRES_USER: 'finflow',
    JWT_SECRET: 'generated',
  });

  assert.deepEqual(result.addedKeys, ['POSTGRES_USER']);
  assert.deepEqual(result.preservedKeys, ['POSTGRES_PORT', 'JWT_SECRET']);
  assert.equal(parseEnv(await readFile(envPath, 'utf8')).POSTGRES_PORT, '15432');
  assert.equal(parseEnv(await readFile(envPath, 'utf8')).POSTGRES_USER, 'finflow');
  assert.equal(parseEnv(await readFile(envPath, 'utf8')).JWT_SECRET, 'custom');
  assert.match(await readFile(envPath, 'utf8'), /# Keep my local notes/);
});

test('prepareEnv reuses existing root secrets when completing backend env', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'seneca-prepare-env-'));
  await writeFile(
    path.join(dir, '.env'),
    'JWT_SECRET=root-jwt\nJWT_REFRESH_SECRET=root-refresh\nINTEGRATIONS_ENCRYPTION_KEY=root-integration\n',
  );

  await prepareEnv({ root: dir, log: false });

  const backendEnv = parseEnv(await readFile(path.join(dir, 'backend/.env'), 'utf8'));
  assert.equal(backendEnv.JWT_SECRET, 'root-jwt');
  assert.equal(backendEnv.JWT_REFRESH_SECRET, 'root-refresh');
  assert.equal(backendEnv.INTEGRATIONS_ENCRYPTION_KEY, 'root-integration');
});

test('detectComposeCommand prefers Docker Compose v2 when available', () => {
  const command = detectComposeCommand((cmd, args) => {
    if (cmd === 'docker' && args.join(' ') === 'compose version') {
      return { status: 0 };
    }
    if (cmd === 'docker-compose' && args.join(' ') === 'version') {
      return { status: 0 };
    }
    return { status: 1 };
  });

  assert.deepEqual(command, ['docker', 'compose']);
});

test('detectComposeCommand falls back to docker-compose v1', () => {
  const command = detectComposeCommand((cmd, args) => {
    if (cmd === 'docker-compose' && args.join(' ') === 'version') {
      return { status: 0 };
    }
    return { status: 1 };
  });

  assert.deepEqual(command, ['docker-compose']);
});

test('shouldInstallDependencies checks all workspace node_modules folders', () => {
  assert.equal(
    shouldInstallDependencies(new Set(['node_modules', 'backend/node_modules', 'frontend/node_modules'])),
    false,
  );
  assert.equal(shouldInstallDependencies(new Set(['node_modules', 'backend/node_modules'])), true);
});

test('root package exposes one-command development entrypoints', async () => {
  const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));

  assert.equal(packageJson.scripts['setup:dev'], 'node scripts/setup-dev.mjs');
  assert.equal(packageJson.scripts['setup:dev:docker'], 'node scripts/setup-dev.mjs --docker');
  assert.equal(packageJson.scripts['setup:dev:local'], 'node scripts/setup-dev.mjs --local');
  assert.equal(packageJson.scripts['setup:dev:native'], 'node scripts/setup-dev.mjs --native');
  assert.equal(packageJson.scripts['setup:env'], 'node scripts/setup-dev.mjs --env-only');
});

test('getPostgresConnection parses generated development DATABASE_URL', () => {
  const connection = getPostgresConnection('postgresql://finflow:finflow@localhost:5434/finflow');

  assert.equal(connection.user, 'finflow');
  assert.equal(connection.password, 'finflow');
  assert.equal(connection.host, 'localhost');
  assert.equal(connection.port, '5434');
  assert.equal(connection.database, 'finflow');
  assert.equal(connection.maintenanceUrl, 'postgresql://finflow:finflow@localhost:5434/postgres');
});

test('getMissingNativeCommands reports only absent native dependencies', () => {
  const missing = getMissingNativeCommands((command) => command === 'psql');

  assert.deepEqual(missing, ['redis-cli']);
});

test('setup help documents native mode', async () => {
  const script = await readFile(path.join(rootDir, 'scripts/setup-dev.mjs'), 'utf8');

  assert.match(script, /--native\s+Start local backend\/frontend with locally installed PostgreSQL\/Redis/);
  assert.match(script, /Local app \+ local PostgreSQL\/Redis/);
});

test('make quick-dev delegates to the npm bootstrap entrypoint', async () => {
  const makefile = await readFile(path.join(rootDir, 'Makefile'), 'utf8');

  assert.match(makefile, /quick-dev:[\s\S]*?\n\t@npm run setup:dev:docker/);
  assert.match(makefile, /setup:[\s\S]*?\n\t@npm run setup:env/);
});

test('legacy env generator delegates to the canonical setup script', async () => {
  const generator = await readFile(path.join(rootDir, 'scripts/generate-env.sh'), 'utf8');

  assert.match(generator, /node scripts\/setup-dev\.mjs --env-only "\$@"/);
});
