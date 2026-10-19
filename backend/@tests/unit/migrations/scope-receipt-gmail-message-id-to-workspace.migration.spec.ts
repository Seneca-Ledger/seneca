import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('ScopeReceiptGmailMessageIdToWorkspace migration', () => {
  it('makes a Gmail message id unique per workspace instead of globally', () => {
    const filePath = path.join(
      process.cwd(),
      'src',
      'migrations',
      '1786530000000-ScopeReceiptGmailMessageIdToWorkspace.ts',
    );

    expect(existsSync(filePath)).toBe(true);
    const source = readFileSync(filePath, 'utf8');
    const [up, down] = source.split('public async down');
    expect(up).toContain('ON "receipts" ("workspace_id", "gmail_message_id")');
    expect(up).toContain('DROP INDEX IF EXISTS "IDX_receipts_gmail_message_id_unique_not_null"');
    expect(down).toContain('ON "receipts" ("gmail_message_id")');
    expect(down).toContain('DROP INDEX IF EXISTS "IDX_receipts_workspace_gmail_message_id_unique"');
  });
});
