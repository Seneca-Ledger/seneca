// Fails when any installed dependency is under a license outside ALLOWED.
// Run: npm run licenses:check. It runs in CI, in `npm test` and before a push.
//
// Each package tree (root, backend, frontend, website) is read with
// license-checker-rseidelsohn. SPDX expressions are evaluated: `A OR B` passes
// if either side is allowed, `A AND B` only if both are. A license the checker
// had to guess (`MIT*`) counts as that license; a custom or missing license
// never passes.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { init } from 'license-checker-rseidelsohn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TREES = ['.', 'backend', 'frontend', 'website'];

/** Free software licenses the project accepts in its dependencies. */
export const ALLOWED = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'Unlicense',
  'CC0-1.0',
  'BlueOak-1.0.0',
  'Zlib',
  // MIT without the attribution clause (nodemailer, @csstools/*)
  'MIT-0',
  // weak, file-level copyleft: lightningcss (inside Vite), web-push, @vercel/og
  'MPL-2.0',
  // the libvips binary inside sharp
  'LGPL-3.0-or-later',
  // argparse, a js-yaml dependency
  'Python-2.0',
  'PSF-2.0',
  // caniuse-lite, the browser data behind browserslist
  'CC-BY-4.0',
  // the SPDX license data this checker itself reads (spdx-exceptions, spdx-ranges)
  'CC-BY-3.0',
]);

const tokenize = expression =>
  expression
    .replace(/[()]/g, match => ` ${match} `)
    .split(/\s+/)
    .filter(Boolean);

/** Evaluates an SPDX expression against ALLOWED. */
export function isAllowed(expression) {
  const tokens = tokenize(String(expression));
  let position = 0;
  const atom = () => {
    const token = tokens[position++];
    if (token === '(') {
      const value = anyOf();
      position++; // ')'
      return value;
    }
    if (tokens[position] === 'WITH') position += 2; // an exception never narrows a grant
    return ALLOWED.has(String(token).replace(/\*$/, ''));
  };
  const allOf = () => {
    let value = atom();
    while (tokens[position] === 'AND') {
      position++;
      value = atom() && value;
    }
    return value;
  };
  function anyOf() {
    let value = allOf();
    while (tokens[position] === 'OR') {
      position++;
      value = allOf() || value;
    }
    return value;
  }
  return tokens.length > 0 && anyOf() && position >= tokens.length;
}

const licensesOf = info =>
  Array.isArray(info.licenses) ? info.licenses.join(' OR ') : (info.licenses ?? 'UNKNOWN');

const scan = start =>
  new Promise((resolve, reject) => {
    init({ start, excludePrivatePackages: true }, (error, packages) =>
      error ? reject(error) : resolve(packages),
    );
  });

async function main() {
  const problems = [];
  for (const tree of TREES) {
    const start = path.join(ROOT, tree);
    if (!existsSync(path.join(start, 'node_modules'))) {
      // CI installs every tree; a local push may not have the website installed.
      if (process.env.CI) problems.push(`${tree}: node_modules is missing`);
      else console.warn(`licenses: skipped ${tree} (not installed)`);
      continue;
    }
    const packages = await scan(start);
    for (const [name, info] of Object.entries(packages)) {
      const license = licensesOf(info);
      if (!isAllowed(license)) problems.push(`${tree}: ${name} (${license})`);
    }
  }
  if (problems.length > 0) {
    console.error('✖ Dependencies under a license outside the allowlist:');
    for (const problem of problems) {
      console.error(`  ${problem}`);
    }
    console.error(
      'Replace the package, or add its license to ALLOWED in scripts/check-licenses.mjs.',
    );
    process.exitCode = 1;
    return;
  }
  console.log(`licenses: every dependency is under an allowed license (${TREES.join(', ')})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
