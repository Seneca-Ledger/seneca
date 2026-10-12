import { readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * With strictNullChecks, tsc emits `Object` as the design type of a property
 * declared `string | null`, and TypeORM cannot infer a column type from it:
 * the app (and every migration run) fails at startup with
 * `DataTypeNotSupportedError`. Jest compiles with Babel, whose metadata differs,
 * so no other unit test notices. A column whose property type is a union must
 * name its type.
 */
const ENTITY_DIRS = [path.join(process.cwd(), 'src')];
const COLUMN_THEN_PROPERTY =
  /@(Column|PrimaryColumn)\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)\s*(?:@\w+\((?:[^()]|\([^()]*\))*\)\s*)*(\w+)[?!]?\s*:\s*([^;=\n]+)/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('entity columns', () => {
  it('name their type whenever the property type is a union', () => {
    const untyped: string[] = [];
    for (const file of ENTITY_DIRS.flatMap(sourceFiles)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(COLUMN_THEN_PROPERTY)) {
        const [, , options, property, type] = match;
        const namesType = /^\s*['"]/.test(options) || /\btype\s*:/.test(options);
        if (type.includes('|') && !namesType) {
          untyped.push(`${path.relative(process.cwd(), file)}: ${property}: ${type.trim()}`);
        }
      }
    }
    expect(untyped).toEqual([]);
  });
});
