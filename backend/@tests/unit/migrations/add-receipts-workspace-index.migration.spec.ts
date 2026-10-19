import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddReceiptsWorkspaceIndex migration', () => {
  it('indexes receipts by workspace and date, and drops the index on the way down', () => {
    const filePath = path.join(
      process.cwd(),
      'src',
      'migrations',
      '1786480000000-AddReceiptsWorkspaceIndex.ts',
    );

    expect(existsSync(filePath)).toBe(true);
    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain(
      'CREATE INDEX IF NOT EXISTS "IDX_receipts_workspace_received_at" ON "receipts" ("workspace_id", "received_at")',
    );
    expect(source).toContain('DROP INDEX IF EXISTS "IDX_receipts_workspace_received_at"');
  });
});
