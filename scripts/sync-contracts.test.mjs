import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findProblems, HEADER, sync, TARGETS } from './sync-contracts.mjs';

function write(root, file, content) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}

function makeRepo({ effect = '4.0.3', frontendEffect = effect } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'contracts-'));
  write(root, 'packages/contracts/package.json', JSON.stringify({ devDependencies: { effect } }));
  write(root, 'backend/package.json', JSON.stringify({ dependencies: { effect } }));
  write(
    root,
    'frontend/package.json',
    JSON.stringify({ dependencies: { effect: frontendEffect } }),
  );
  write(root, 'packages/contracts/src/index.ts', "export * from './goals/items';\n");
  write(root, 'packages/contracts/src/goals/items.ts', 'export const a = 1;\n');
  return root;
}

test('sync copies every source file into both apps with the generated header', () => {
  const root = makeRepo();
  sync(root);

  for (const target of TARGETS) {
    assert.equal(
      readFileSync(path.join(root, target, 'goals/items.ts'), 'utf8'),
      `${HEADER}export const a = 1;\n`,
    );
  }
  assert.deepEqual(findProblems(root), []);
});

test('check reports edited, missing and orphaned copies', () => {
  const root = makeRepo();
  sync(root);
  write(root, 'backend/src/contracts/goals/items.ts', 'export const a = 2;\n');
  write(root, 'frontend/app/lib/contracts/old.ts', 'export {};\n');
  write(root, 'packages/contracts/src/goals/new.ts', 'export {};\n');

  assert.deepEqual(findProblems(root).sort(), [
    'backend/src/contracts/goals/items.ts is stale',
    'backend/src/contracts/goals/new.ts is missing',
    'frontend/app/lib/contracts/goals/new.ts is missing',
    'frontend/app/lib/contracts/old.ts has no source',
  ]);

  sync(root);
  assert.deepEqual(findProblems(root), []);
});

test('check fails when the apps pin different effect versions', () => {
  const root = makeRepo({ frontendEffect: '4.0.4' });
  sync(root);

  const [problem] = findProblems(root);
  assert.match(problem, /^effect versions differ: .*frontend\/package\.json=4\.0\.4/);
});

test('the committed copies match packages/contracts', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  assert.deepEqual(findProblems(repoRoot), []);
});
