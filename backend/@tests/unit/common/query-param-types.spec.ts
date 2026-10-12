import { readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Under strictNullChecks a handler parameter typed `string | undefined` gets
 * `Object` as its design type, and the global ValidationPipe then stops
 * coercing it to a string: `?reviewer=me&reviewer=me` reaches the handler as an
 * array. Type a single @Query/@Param as `string` (or make it a trailing `x?:`),
 * so the metadata stays `String`.
 */
const NULLABLE_PARAM = /@(Query|Param)\('[^']+'(?:, [^)]*)?\) (\w+): [^,)]*\| ?(?:undefined|null)/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.controller.ts') ? [full] : [];
  });
}

describe('controller query and route parameters', () => {
  it('are never typed as a union with undefined or null', () => {
    const offenders = sourceFiles(path.join(process.cwd(), 'src')).flatMap(file =>
      [...readFileSync(file, 'utf8').matchAll(NULLABLE_PARAM)].map(
        match => `${path.relative(process.cwd(), file)}: ${match[2]}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
