import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddUserTelegramWorkspace migration', () => {
  it('adds the workspace a Telegram chat serves, cleared when the workspace goes', () => {
    const filePath = path.join(
      process.cwd(),
      'src',
      'migrations',
      '1786540000000-AddUserTelegramWorkspace.ts',
    );

    expect(existsSync(filePath)).toBe(true);
    const source = readFileSync(filePath, 'utf8');
    const [up, down] = source.split('public async down');
    expect(up).toContain('ADD COLUMN IF NOT EXISTS "telegram_workspace_id" uuid NULL');
    expect(up).toContain('REFERENCES "workspaces"("id") ON DELETE SET NULL');
    expect(down).toContain('DROP CONSTRAINT IF EXISTS "FK_users_telegram_workspace"');
    expect(down).toContain('DROP COLUMN IF EXISTS "telegram_workspace_id"');
  });
});
