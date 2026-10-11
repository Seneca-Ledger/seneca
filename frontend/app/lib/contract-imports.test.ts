import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contract schemas pull effect (~67 kB gzip) into whatever chunk imports them.
 * Only contract-check.ts, which production compiles out, may import them as
 * values; everything else imports their types.
 */
const APP = path.join(process.cwd(), 'app');
const VALUE_IMPORT = /^import\s+(?!type\b)[^;]*from\s+'(?:@\/app\/lib|\.{1,2}(?:\/[\w.-]+)*)\/contracts';/m;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'contracts' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('contract imports', () => {
  it('are type-only outside contract-check.ts', () => {
    const offenders = sourceFiles(APP)
      .filter(file => !file.endsWith(`${path.sep}contract-check.ts`))
      .filter(file => VALUE_IMPORT.test(readFileSync(file, 'utf8')))
      .map(file => path.relative(APP, file));
    expect(offenders).toEqual([]);
  });
});
