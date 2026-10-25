import * as fs from 'node:fs';
import * as path from 'node:path';
import { ERR } from '@/common/errors/app-error';

/**
 * Every HTTP exception carries a code from the catalogue in
 * common/errors/app-error.ts, so the client can translate it. A plain string
 * reaches the client as a generic BAD_REQUEST/NOT_FOUND with English text, in
 * every language. Give the text a code: throw new XException(appError('CODE')).
 */
const SRC = path.resolve(__dirname, '../../../../src');

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'contracts' ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [full] : [];
  });

describe('typed HTTP errors', () => {
  it('throws every Nest HTTP exception with appError(code)', () => {
    const untyped = sourceFiles(SRC).flatMap(file => {
      const source = fs.readFileSync(file, 'utf8');
      return [...source.matchAll(/throw new ([A-Z]\w*Exception)\(\s*/g)]
        // appError('CODE'), or { ...appError('CODE'), extra } with details for the client.
        .filter(match => !/^(\{\s*\.\.\.)?appError\(/.test(source.slice((match.index ?? 0) + match[0].length)))
        .map(match => {
          const line = source.slice(0, match.index).split('\n').length;
          return `${path.relative(SRC, file)}:${line} ${match[1]}`;
        });
    });

    expect(untyped).toEqual([]);
  });

  it('defines each code in one catalogue file only', () => {
    // ERR spreads the files in common/errors/codes; a key in two of them would
    // silently take the later message.
    const dir = path.join(SRC, 'common/errors/codes');
    const keys = fs
      .readdirSync(dir)
      .flatMap(file => [...fs.readFileSync(path.join(dir, file), 'utf8').matchAll(/^\s+([A-Z][A-Z0-9_]+):/gm)])
      .map(match => match[1]);
    expect(keys.length).toBe(Object.keys(ERR).length);
  });
});
