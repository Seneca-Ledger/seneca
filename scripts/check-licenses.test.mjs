import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowed } from './check-licenses.mjs';

test('allows a listed license, also when the checker guessed it', () => {
  assert.equal(isAllowed('MIT'), true);
  assert.equal(isAllowed('MIT*'), true);
  assert.equal(isAllowed('Apache-2.0'), true);
});

test('rejects licenses outside the list, custom and unknown ones', () => {
  assert.equal(isAllowed('GPL-3.0-only'), false);
  assert.equal(isAllowed('Custom: LICENSE'), false);
  assert.equal(isAllowed('UNKNOWN'), false);
  assert.equal(isAllowed(''), false);
});

test('passes an OR when either side is allowed, an AND only when both are', () => {
  assert.equal(isAllowed('(MIT OR GPL-3.0-or-later)'), true);
  assert.equal(isAllowed('(GPL-2.0 OR AGPL-3.0)'), false);
  assert.equal(isAllowed('(MIT AND Zlib)'), true);
  assert.equal(isAllowed('(MIT AND GPL-3.0-only)'), false);
  assert.equal(isAllowed('(Apache-2.0 AND (MIT OR GPL-2.0))'), true);
});

test('reads an exception as the license it is attached to', () => {
  assert.equal(isAllowed('Apache-2.0 WITH LLVM-exception'), true);
  assert.equal(isAllowed('GPL-2.0 WITH Classpath-exception-2.0'), false);
});
