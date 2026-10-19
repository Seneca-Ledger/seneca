import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('Entities barrel exports', () => {
  it('re-exports workspace-scoped supporting entities', () => {
    const filePath = path.join(process.cwd(), 'src', 'entities', 'index.ts');

    expect(existsSync(filePath)).toBe(true);

    const source = readFileSync(filePath, 'utf8');

    expect(source).toContain("export * from './data-entry-custom-field.entity'");
    expect(source).toContain("export * from './custom-table-column-style.entity'");
    expect(source).toContain("export * from './custom-table-cell-style.entity'");
    expect(source).toContain("export * from './file-version.entity'");
    expect(source).toContain("export * from './backup-configuration.entity'");
    expect(source).toContain("export * from './backup-run.entity'");
  });
});
