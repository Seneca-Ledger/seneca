import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('FixWorkspaceDeletionConstraints migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1786240000000-FixWorkspaceDeletionConstraints.ts',
  );

  it('makes audit_events.workspace_id nullable so SET NULL can fire on workspace deletion', () => {
    expect(existsSync(filePath)).toBe(true);
    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain(
      'ALTER TABLE "audit_events" ALTER COLUMN "workspace_id" DROP NOT NULL',
    );
  });

  it('recreates the three transaction reference FKs with ON DELETE SET NULL', () => {
    const source = readFileSync(filePath, 'utf8');
    for (const name of [
      'FK_transactions_category_id',
      'FK_transactions_branch_id',
      'FK_transactions_wallet_id',
    ]) {
      expect(source).toContain(`ADD CONSTRAINT "${name}"`);
    }
    expect(source.match(/ON DELETE SET NULL/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('drops the old auto-named FKs by column lookup, not by hardcoded hash names', () => {
    const source = readFileSync(filePath, 'utf8');
    expect(source).toContain('pg_constraint');
    expect(source).toContain("att.attname IN ('category_id', 'branch_id', 'wallet_id')");
  });
});
