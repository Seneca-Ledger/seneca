import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../intlayer.config';

// Every code the backend can send has a translation in every locale, so an
// error toast is never left in English. A new code in
// backend/src/common/errors/codes/<domain>.ts goes into
// app/lib/api-errors/<domain>.content.ts (or apiErrors.content.ts).
const FRONTEND = process.cwd();
const BACKEND_CODES = path.join(FRONTEND, '../backend/src/common/errors/codes');
const DICTIONARIES = [
  path.join(FRONTEND, 'app/lib/apiErrors.content.ts'),
  ...readdirSync(path.join(FRONTEND, 'app/lib/api-errors')).map(file =>
    path.join(FRONTEND, 'app/lib/api-errors', file),
  ),
];
const LOCALES = config.internationalization?.locales ?? [];

const backendCodes = (): string[] =>
  readdirSync(BACKEND_CODES).flatMap(file =>
    [...readFileSync(path.join(BACKEND_CODES, file), 'utf8').matchAll(/^\s+([A-Z][A-Z0-9_]+):/gm)].map(
      match => match[1],
    ),
  );

/** code → locales its t({...}) block names, from every error dictionary. */
const translations = (): Map<string, string[]> =>
  new Map(
    DICTIONARIES.flatMap(file =>
      [...readFileSync(file, 'utf8').matchAll(/^ {4}([A-Z][A-Z0-9_]+): t\(\{([\s\S]*?)\}\),$/gm)].map(
        match => [match[1], [...match[2].matchAll(/^\s+(\w+):/gm)].map(locale => locale[1])] as const,
      ),
    ),
  );

describe('backend error codes', () => {
  it('has a translation for every code', () => {
    const known = translations();
    expect(backendCodes().filter(code => !known.has(code))).toEqual([]);
  });

  it('translates every code into every locale', () => {
    const incomplete = [...translations()].flatMap(([code, locales]) => {
      const missing = LOCALES.filter(locale => !locales.includes(locale));
      return missing.length > 0 ? [`${code}: ${missing.join(', ')}`] : [];
    });
    expect(incomplete).toEqual([]);
  });
});
