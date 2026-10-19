#!/usr/bin/env node
import { createServer } from 'node:net';
import { createInterface } from 'node:readline/promises';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const composeFiles = ['-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml'];
const demoEmail = 'demo@seneca.dev';
const demoPassword = 'demo123';

export function parseEnv(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const equals = trimmed.indexOf('=');
    if (equals === -1) {
      continue;
    }
    env[trimmed.slice(0, equals)] = trimmed.slice(equals + 1);
  }
  return env;
}

function serializeEnv(env) {
  return `${Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

function appendEnvEntries(original, entries) {
  if (entries.length === 0) {
    return original;
  }
  const prefix = original && !original.endsWith('\n') ? `${original}\n` : original;
  return `${prefix}${entries.map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

function secret() {
  return randomBytes(32).toString('base64url');
}

export function buildRootEnv(values = {}) {
  return {
    POSTGRES_USER: 'finflow',
    POSTGRES_PASSWORD: 'finflow',
    POSTGRES_DB: 'finflow',
    POSTGRES_PORT: '5434',
    REDIS_PORT: '6379',
    FRONTEND_URL: 'http://localhost:3000',
    APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_API_URL: 'http://localhost:3001/api/v1',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    JWT_SECRET: values.jwtSecret || secret(),
    JWT_REFRESH_SECRET: values.jwtRefreshSecret || secret(),
    INTEGRATIONS_ENCRYPTION_KEY: values.integrationsEncryptionKey || secret(),
  };
}

export function buildBackendEnv(values = {}) {
  return {
    NODE_ENV: 'development',
    PORT: '3001',
    FRONTEND_URL: 'http://localhost:3000',
    APP_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://finflow:finflow@localhost:5434/finflow',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: values.jwtSecret || secret(),
    JWT_REFRESH_SECRET: values.jwtRefreshSecret || secret(),
    INTEGRATIONS_ENCRYPTION_KEY: values.integrationsEncryptionKey || secret(),
  };
}

function buildFrontendEnv() {
  return {
    NEXT_PUBLIC_API_URL: 'http://localhost:3001/api/v1',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_ENV: 'development',
  };
}

export async function applyEnvDefaults(filePath, defaults, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const original = existsSync(filePath) ? await readFile(filePath, 'utf8') : '';
  const current = parseEnv(original);
  const addedKeys = [];
  const preservedKeys = [];
  const addedEntries = [];

  for (const [key, value] of Object.entries(defaults)) {
    if (Object.prototype.hasOwnProperty.call(current, key) && current[key] !== '') {
      preservedKeys.push(key);
    } else {
      addedEntries.push([key, value]);
      addedKeys.push(key);
    }
  }

  if (!dryRun && addedKeys.length > 0) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, original ? appendEnvEntries(original, addedEntries) : serializeEnv(Object.fromEntries(addedEntries)));
  } else if (!dryRun && !existsSync(filePath)) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, serializeEnv(Object.fromEntries(addedEntries)));
  }

  return { addedKeys, preservedKeys };
}

export function detectComposeCommand(run = spawnSync) {
  const v2 = run('docker', ['compose', 'version'], { stdio: 'ignore' });
  if (v2.status === 0) {
    return ['docker', 'compose'];
  }

  const v1 = run('docker-compose', ['version'], { stdio: 'ignore' });
  if (v1.status === 0) {
    return ['docker-compose'];
  }

  return null;
}

export function shouldInstallDependencies(existingPaths) {
  return !(
    existingPaths.has('node_modules') &&
    existingPaths.has('backend/node_modules') &&
    existingPaths.has('frontend/node_modules')
  );
}

function commandExists(command) {
  const result =
    process.platform === 'win32'
      ? spawnSync('where', [command], { stdio: 'ignore' })
      : spawnSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
  return result.status === 0;
}

export function getPostgresConnection(databaseUrl) {
  const url = new URL(databaseUrl);
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname || 'localhost',
    port: url.port || '5432',
    database: url.pathname.replace(/^\//, ''),
    maintenanceUrl: `${url.protocol}//${url.username}:${url.password}@${url.hostname || 'localhost'}:${url.port || '5432'}/postgres`,
    localMaintenanceUrl: `${url.protocol}//${url.hostname || 'localhost'}:${url.port || '5432'}/postgres`,
  };
}

function getRedisConnection(redisUrl) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname || 'localhost',
    port: url.port || '6379',
  };
}

function quoteSqlIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsupported PostgreSQL identifier: ${value}`);
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function hasAllNodeModules() {
  return !shouldInstallDependencies(
    new Set(
      ['node_modules', 'backend/node_modules', 'frontend/node_modules'].filter((dir) =>
        existsSync(path.join(rootDir, dir)),
      ),
    ),
  );
}

function commandToString(command) {
  return command.join(' ');
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: options.stdio || 'inherit',
      env: { ...process.env, ...options.env },
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

function runSync(command, args) {
  return spawnSync(command, args, { cwd: rootDir, stdio: 'ignore' });
}

function composeArgs(args) {
  return [...composeFiles, ...args];
}

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function assertPortsAvailable(ports) {
  const conflicts = [];
  for (const port of ports) {
    if (await isPortOpen(port)) {
      conflicts.push(port);
    }
  }
  if (conflicts.length > 0) {
    throw new Error(
      `Port(s) already in use: ${conflicts.join(', ')}. Stop the conflicting process or change the matching *_PORT value in .env.`,
    );
  }
}

export async function prepareEnv({ dryRun = false, root = rootDir, log = true } = {}) {
  const rootEnv = buildRootEnv();
  const rootEnvPath = path.join(root, '.env');
  const existingRootEnv = existsSync(rootEnvPath) ? parseEnv(await readFile(rootEnvPath, 'utf8')) : {};
  const sharedSecrets = {
    jwtSecret: existingRootEnv.JWT_SECRET || rootEnv.JWT_SECRET,
    jwtRefreshSecret: existingRootEnv.JWT_REFRESH_SECRET || rootEnv.JWT_REFRESH_SECRET,
    integrationsEncryptionKey: existingRootEnv.INTEGRATIONS_ENCRYPTION_KEY || rootEnv.INTEGRATIONS_ENCRYPTION_KEY,
  };
  const results = [
    ['.env', await applyEnvDefaults(rootEnvPath, rootEnv, { dryRun })],
    ['backend/.env', await applyEnvDefaults(path.join(root, 'backend/.env'), buildBackendEnv(sharedSecrets), { dryRun })],
    ['frontend/.env.local', await applyEnvDefaults(path.join(root, 'frontend/.env.local'), buildFrontendEnv(), { dryRun })],
  ];

  if (log) {
    for (const [file, result] of results) {
      const added = result.addedKeys.length > 0 ? `added ${result.addedKeys.join(', ')}` : 'no missing keys';
      const preserved =
        result.preservedKeys.length > 0 ? `; preserved existing ${result.preservedKeys.join(', ')}` : '';
      console.log(`${dryRun ? '[dry-run] ' : ''}${file}: ${added}${preserved}`);
    }
  }
}

function requireCompose() {
  const compose = detectComposeCommand();
  if (!compose) {
    throw new Error('Docker Compose was not found. Install Docker Desktop or Docker Engine with Compose v2.');
  }

  const dockerInfo = runSync('docker', ['info']);
  if (dockerInfo.status !== 0) {
    throw new Error('Docker is installed, but the Docker daemon is not reachable. Start Docker and try again.');
  }

  return compose;
}

async function waitForHealth(url, label, attempts = 60) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

async function runDockerMode() {
  await prepareEnv();
  const compose = requireCompose();
  console.log(`Using ${commandToString(compose)}`);
  await run(compose[0], [...compose.slice(1), ...composeArgs(['up', '-d', '--build'])]);
  const rootEnv = parseEnv(await readFile(path.join(rootDir, '.env'), 'utf8'));
  const backendPort = rootEnv.BACKEND_PORT || '3001';
  await waitForHealth(`http://localhost:${backendPort}/api/v1/health/ready`, 'Backend');
  await run('docker', ['exec', 'finflow-backend', 'sh', '-lc', 'NODE_OPTIONS=--max-old-space-size=2048 npm run seed:demo:dev']);
  printReady();
}

async function installDependenciesIfNeeded() {
  if (hasAllNodeModules()) {
    console.log('Dependencies already installed.');
    return;
  }
  console.log('Installing npm dependencies...');
  await run('npm', ['install']);
  await run('npm', ['--prefix', 'backend', 'install']);
  await run('npm', ['--prefix', 'frontend', 'install']);
}

async function runLocalMode() {
  await prepareEnv();
  const compose = requireCompose();
  console.log(`Using ${commandToString(compose)} for PostgreSQL and Redis`);
  await assertPortsAvailable([3000, 3001]);
  await run(compose[0], [...compose.slice(1), ...composeArgs(['up', '-d', 'postgres', 'redis'])]);
  await installDependenciesIfNeeded();
  await run('npm', ['--prefix', 'backend', 'run', 'migration:run:dev']);
  await run('npm', ['--prefix', 'backend', 'run', 'seed:demo:dev']);
  printReady();
  await run('npm', ['run', 'dev']);
}

async function readPreparedBackendEnv() {
  const backendEnvPath = path.join(rootDir, 'backend/.env');
  return parseEnv(await readFile(backendEnvPath, 'utf8'));
}

function runQuiet(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'ignore',
    env: { ...process.env, ...options.env },
  });
}

function runCapture(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
  });
}

export function getMissingNativeCommands(commandExistsFn = commandExists) {
  const missing = [];
  if (!commandExistsFn('psql')) {
    missing.push('psql');
  }
  if (!commandExistsFn('redis-cli')) {
    missing.push('redis-cli');
  }
  return missing;
}

function ensureNativeCommands() {
  const missing = getMissingNativeCommands();
  if (missing.length > 0) {
    throw new Error(
      `Native mode needs locally installed ${missing.join(', ')}. Install PostgreSQL and Redis, start them, then rerun npm run setup:dev:native.`,
    );
  }
}

function ensureNativePostgres(databaseUrl) {
  const connection = getPostgresConnection(databaseUrl);
  const testConnection = () => runQuiet('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT 1;']);

  if (testConnection().status === 0) {
    return;
  }

  const role = quoteSqlIdentifier(connection.user);
  const database = quoteSqlIdentifier(connection.database);
  const roleSql = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${connection.user.replaceAll("'", "''")}') THEN
    CREATE ROLE ${role} LOGIN PASSWORD '${connection.password.replaceAll("'", "''")}';
  END IF;
END $$;
`;
  const setupRole = runCapture('psql', [connection.localMaintenanceUrl, '-v', 'ON_ERROR_STOP=1', '-c', roleSql]);
  const hasDatabase = runCapture('psql', [
    connection.localMaintenanceUrl,
    '-v',
    'ON_ERROR_STOP=1',
    '-tAc',
    `SELECT 1 FROM pg_database WHERE datname = '${connection.database.replaceAll("'", "''")}';`,
  ]);
  const createDatabase =
    hasDatabase.status === 0 && hasDatabase.stdout.trim() === '1'
      ? { status: 0, stderr: '', stdout: '' }
      : runCapture('psql', [
          connection.localMaintenanceUrl,
          '-v',
          'ON_ERROR_STOP=1',
          '-c',
          `CREATE DATABASE ${database} OWNER ${role};`,
        ]);

  if (setupRole.status !== 0 || createDatabase.status !== 0 || testConnection().status !== 0) {
    const detail = [setupRole.stderr, hasDatabase.stderr, createDatabase.stderr, setupRole.stdout, createDatabase.stdout]
      .filter(Boolean)
      .join('\n')
      .trim();
    throw new Error(
      `Local PostgreSQL is not ready for ${databaseUrl}. Start PostgreSQL on port ${connection.port} and make sure your local user can create roles/databases.${detail ? ` psql said: ${detail}` : ''}`,
    );
  }
}

function ensureNativeRedis(redisUrl) {
  const connection = getRedisConnection(redisUrl);
  const ping = runCapture('redis-cli', ['-h', connection.host, '-p', connection.port, 'ping']);
  if (ping.status !== 0 || !/^PONG\s*$/i.test(ping.stdout || '')) {
    throw new Error(`Local Redis is not reachable at ${connection.host}:${connection.port}. Start redis-server and rerun npm run setup:dev:native.`);
  }
}

async function runNativeMode() {
  await prepareEnv();
  await assertPortsAvailable([3000, 3001]);
  ensureNativeCommands();
  const backendEnv = await readPreparedBackendEnv();
  ensureNativePostgres(backendEnv.DATABASE_URL);
  ensureNativeRedis(backendEnv.REDIS_URL);
  await installDependenciesIfNeeded();
  await run('npm', ['--prefix', 'backend', 'run', 'migration:run:dev']);
  await run('npm', ['--prefix', 'backend', 'run', 'seed:demo:dev']);
  printReady();
  await run('npm', ['run', 'dev']);
}

function printReady() {
  console.log('');
  console.log('Seneca is ready:');
  console.log('  Frontend: http://localhost:3000');
  console.log('  Backend:  http://localhost:3001/api/v1');
  console.log('  Swagger:  http://localhost:3001/api/docs');
  console.log(`  Login:    ${demoEmail} / ${demoPassword}`);
  console.log('');
}

function help() {
  console.log(`Usage: node scripts/setup-dev.mjs [mode]

Modes:
  --docker       Start the full Docker development stack.
  --local        Start PostgreSQL/Redis in Docker, then run local backend/frontend.
  --native       Start local backend/frontend with locally installed PostgreSQL/Redis.
  --env-only     Create or complete .env files only.

Options:
  --dry-run      Show env changes without writing files. Only valid with --env-only.
  --help         Show this help.
`);
}

async function chooseMode() {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(
      'Choose dev startup mode:\n  1) Docker full-stack\n  2) Local app + Docker PostgreSQL/Redis\n  3) Local app + local PostgreSQL/Redis\nSelect 1, 2, or 3 [1]: ',
    );
    return answer.trim() === '2' ? 'local' : answer.trim() === '3' ? 'native' : 'docker';
  } finally {
    rl.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    help();
    return;
  }
  if (args.includes('--env-only')) {
    await prepareEnv({ dryRun: args.includes('--dry-run') });
    return;
  }

  const mode = args.includes('--docker')
    ? 'docker'
    : args.includes('--local')
      ? 'local'
      : args.includes('--native')
        ? 'native'
        : await chooseMode();
  if (mode === 'docker') {
    await runDockerMode();
  } else if (mode === 'local') {
    await runLocalMode();
  } else {
    await runNativeMode();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\nSetup failed: ${error.message}`);
    process.exit(1);
  });
}
