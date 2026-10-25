#!/usr/bin/env node
// Keeps source files from growing past MAX_CODE_LINES lines of code (blank and
// comment-only lines do not count). A new file over the limit is refused; a file
// that is already over it may be changed as long as it does not get longer, so the
// big files shrink as they are touched instead of freezing work on them.
//
//   node scripts/check-file-size.mjs --staged       pre-commit: the index against HEAD
//                                                   (and MERGE_HEAD during a merge)
//   node scripts/check-file-size.mjs --base <ref>   CI: HEAD against its merge base with <ref>
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const MAX_CODE_LINES = 300;

const CODE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

// Long by nature or not written by hand: tests, translation dictionaries (35
// locales), migrations, generated contract copies, type declarations, the docs site.
const EXEMPT = [
  /(^|\/)@tests\//,
  /(^|\/)__tests__\//,
  /^frontend\/app\/test\//,
  /\.(test|spec|e2e-spec)\.[cm]?[jt]sx?$/,
  /\.content\.ts$/,
  /[.-]translations\.ts$/,
  /(^|\/)migrations\//,
  /^backend\/src\/contracts\//,
  /^frontend\/app\/lib\/contracts\//,
  /\.d\.ts$/,
  /^website\//,
];

export function isChecked(file) {
  return CODE_FILE.test(file) && !EXEMPT.some(pattern => pattern.test(file));
}

const COMMENT_ONLY = /^(\/\/|\/\*|\*|\{\s*\/\*)/;

/** Lines that are neither blank nor only a comment. */
export function countCodeLines(source) {
  return source.split('\n').filter(line => {
    const text = line.trim();
    return text !== '' && !COMMENT_ONLY.test(text);
  }).length;
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // A missing path is expected (a new file); keep git's message off the terminal.
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function contentAt(cwd, spec) {
  try {
    return git(cwd, ['show', spec]);
  } catch {
    return null;
  }
}

/** MERGE_HEAD too while a merge is in progress: both sides are a previous version. */
function stagedBaseRefs(cwd) {
  try {
    git(cwd, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']);
    return ['HEAD', 'MERGE_HEAD'];
  } catch {
    return ['HEAD'];
  }
}

/**
 * The files a change adds or modifies, with their previous versions:
 * `[{ file, befores, after }]`, `befores` empty for a new file.
 */
function changedFiles(cwd, { staged, base }) {
  const diffArgs = staged
    ? ['diff', '--cached', '--name-status', '-M', '--diff-filter=AMR']
    : ['diff', '--name-status', '-M', '--diff-filter=AMR', `${base}...HEAD`];
  const fromRefs = staged ? stagedBaseRefs(cwd) : [git(cwd, ['merge-base', base, 'HEAD']).trim()];
  return git(cwd, diffArgs)
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [status, ...paths] = line.split('\t');
      const file = paths.at(-1);
      const previousPath = status.startsWith('R') ? paths[0] : file;
      return {
        file,
        befores: fromRefs
          .map(ref => contentAt(cwd, `${ref}:${previousPath}`))
          .filter(content => content !== null),
        after: contentAt(cwd, staged ? `:${file}` : `HEAD:${file}`) ?? '',
      };
    });
}

/** Files over the limit that are new or grew: `[{ file, lines, before }]`. */
export function findOversized(cwd, options) {
  return changedFiles(cwd, options)
    .filter(({ file }) => isChecked(file))
    .map(({ file, befores, after }) => ({
      file,
      lines: countCodeLines(after),
      before: befores.length === 0 ? null : Math.max(...befores.map(countCodeLines)),
    }))
    .filter(({ lines, before }) => lines > MAX_CODE_LINES && (before === null || lines > before));
}

export function report(oversized) {
  const rows = oversized.map(({ file, lines, before }) =>
    before === null
      ? `  ${file}: ${lines} lines of code (new file, limit ${MAX_CODE_LINES})`
      : `  ${file}: ${lines} lines of code (was ${before}, limit ${MAX_CODE_LINES}; it must not grow)`,
  );
  return [
    '✖ Split it into hooks/helpers.',
    '',
    ...rows,
    '',
    'Move the logic into hooks (hooks/), helpers (helpers/, utils/) or lib/.',
    'Blank lines and comments are not counted.',
  ].join('\n');
}

function main(argv) {
  const staged = argv.includes('--staged');
  const baseIndex = argv.indexOf('--base');
  const base = baseIndex === -1 ? null : argv[baseIndex + 1];
  if (!(staged || base)) {
    console.error('Usage: check-file-size.mjs --staged | --base <ref>');
    return 2;
  }
  const oversized = findOversized(process.cwd(), { staged, base });
  if (oversized.length === 0) {
    return 0;
  }
  console.error(report(oversized));
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
