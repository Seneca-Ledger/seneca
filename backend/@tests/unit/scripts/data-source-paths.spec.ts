import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('data source compiled path resolution', () => {
  it('falls back to dist/src migrations when build:scripts emits there', () => {
    const backendRoot = process.cwd();
    const filePath = path.join(backendRoot, 'src', 'data-source.ts');

    expect(existsSync(filePath)).toBe(true);

    const source = readFileSync(filePath, 'utf8');

    expect(source).toContain("path.join(__dirname, 'src', compiledDirName)");
    expect(source).toContain("migrations: [resolveCompiledGlob('migrations', 'migrations')]");
    expect(source).toContain("resolveCompiledGlob('entities', 'entities')");
    // ApiKey живёт вне src/entities — без этого глоба migration:generate
    // предложил бы удалить таблицу api_keys.
    expect(source).toContain(
      "resolveCompiledGlob('modules/api-keys/entities', 'modules/api-keys/entities')",
    );
  });

  it('loads dist/src data source in the migration lock runner when present', () => {
    const backendRoot = process.cwd();
    const runnerPath = path.join(backendRoot, 'scripts', 'run-migrations-with-lock.js');

    expect(existsSync(runnerPath)).toBe(true);

    const source = readFileSync(runnerPath, 'utf8');

    expect(source).toContain("path.join(__dirname, '../dist/src/data-source.js')");
    expect(source).toContain("? '../dist/src/data-source'");
    expect(source).toContain(": '../dist/data-source'");
  });
});
