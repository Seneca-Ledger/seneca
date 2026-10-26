import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Route params and query strings are decoded by a schema
 * (`@SchemaParams(XParams)`, `@SchemaQuery(XQuery)`), never read raw with
 * `@Param('x')` / `@Query('x')`: a raw value is only a TypeScript promise, so a
 * union like 'mine' | 'shared' passes anything and a malformed id reaches the
 * database.
 */
const SRC = path.resolve(__dirname, '../../../../src');

const controllers = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return controllers(full);
    return entry.name.endsWith('.controller.ts') ? [full] : [];
  });

describe('route params and query strings', () => {
  it('reads every one through a schema', () => {
    const raw = controllers(SRC).flatMap(file => {
      const source = fs.readFileSync(file, 'utf8');
      return [...source.matchAll(/@(Param|Query)\(/g)].map(match => {
        const line = source.slice(0, match.index).split('\n').length;
        return `${path.relative(SRC, file)}:${line} @${match[1]}`;
      });
    });

    expect(raw).toEqual([]);
  });
});
