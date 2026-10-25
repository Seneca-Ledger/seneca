import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  countCodeLines,
  findOversized,
  isChecked,
  MAX_CODE_LINES,
  report,
} from './check-file-size.mjs';

const code = lines =>
  `${Array.from({ length: lines }, (_, i) => `const v${i} = ${i};`).join('\n')}\n`;

function makeRepo() {
  const root = mkdtempSync(path.join(tmpdir(), 'file-size-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'member-1@example.com');
  git('config', 'user.name', 'Member One');
  const write = (file, content) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  write('frontend/app/big.ts', code(MAX_CODE_LINES + 50));
  write('frontend/app/small.ts', code(10));
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  return { root, git, write };
}

test('counts code lines only, not blank or comment lines', () => {
  const source = ['// note', '/**', ' * doc', ' */', '', 'const a = 1;', '{/* jsx */}', 'b();'];
  assert.equal(countCodeLines(source.join('\n')), 2);
});

test('checks app code but not tests, dictionaries, migrations or generated copies', () => {
  assert.equal(isChecked('frontend/app/components/Foo.tsx'), true);
  assert.equal(isChecked('backend/src/modules/x/x.service.ts'), true);
  assert.equal(isChecked('frontend/app/components/Foo.test.tsx'), false);
  assert.equal(isChecked('backend/@tests/unit/x.spec.ts'), false);
  assert.equal(isChecked('frontend/app/page.content.ts'), false);
  assert.equal(isChecked('backend/src/modules/reports/report-template.translations.ts'), false);
  assert.equal(isChecked('backend/src/migrations/1787380000000-Tags.ts'), false);
  assert.equal(isChecked('backend/src/contracts/dashboard/dashboard.ts'), false);
  assert.equal(isChecked('frontend/app/styles/main.scss'), false);
});

test('refuses a new file over the limit', () => {
  const { root, git, write } = makeRepo();
  write('frontend/app/new.ts', code(MAX_CODE_LINES + 1));
  git('add', '-A');

  assert.deepEqual(findOversized(root, { staged: true }), [
    { file: 'frontend/app/new.ts', lines: MAX_CODE_LINES + 1, before: null },
  ]);
});

test('lets an oversized file change while it does not grow, refuses it when it grows', () => {
  const { root, git, write } = makeRepo();
  write('frontend/app/big.ts', code(MAX_CODE_LINES + 40));
  git('add', '-A');
  assert.deepEqual(findOversized(root, { staged: true }), []);

  write('frontend/app/big.ts', code(MAX_CODE_LINES + 60));
  git('add', '-A');
  assert.deepEqual(findOversized(root, { staged: true }), [
    { file: 'frontend/app/big.ts', lines: MAX_CODE_LINES + 60, before: MAX_CODE_LINES + 50 },
  ]);
});

test('refuses a small file that grows past the limit', () => {
  const { root, git, write } = makeRepo();
  write('frontend/app/small.ts', code(MAX_CODE_LINES + 5));
  git('add', '-A');

  assert.equal(findOversized(root, { staged: true }).length, 1);
});

test('compares a branch with its merge base in CI mode', () => {
  const { root, git, write } = makeRepo();
  git('checkout', '-q', '-b', 'feature');
  write('frontend/app/grown.ts', code(MAX_CODE_LINES + 2));
  git('add', '-A');
  git('commit', '-q', '-m', 'grow');

  assert.deepEqual(findOversized(root, { base: 'main' }), [
    { file: 'frontend/app/grown.ts', lines: MAX_CODE_LINES + 2, before: null },
  ]);
});

test('says to split the file into hooks and helpers', () => {
  const message = report([{ file: 'frontend/app/x.ts', lines: 320, before: null }]);
  assert.match(message, /^✖ Разбей на хуки\/хелперы/);
  assert.match(message, /frontend\/app\/x\.ts: 320 строк кода/);
});
