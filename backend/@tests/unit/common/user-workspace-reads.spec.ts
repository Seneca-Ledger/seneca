import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * `user.workspaceId` is the workspace a user registered with (users.workspace_id).
 * Switching workspace never changes it, so scoping a request by it shows one
 * workspace's data in every other one. The workspace of a request is
 * `@WorkspaceId()`, set by WorkspaceContextGuard from X-Workspace-Id.
 *
 * The files below read it on purpose: they create or repair that registration
 * workspace, or fall back to it where no request exists.
 */
const ALLOWED = new Set([
  // Registration, the dev admin bootstrap and the login response.
  'modules/auth/auth.service.ts',
  // GET /auth/me reports the registration workspace, as the login response does.
  'modules/auth/current-user.view.ts',
  // ensureUserWorkspace and clearing it when the member is removed.
  'modules/workspaces/workspaces.service.ts',
  // Onboarding edits the registration workspace.
  'modules/users/users.service.ts',
  // Settings read by mail and scheduled reports, which have no request.
  'modules/application-settings/application-settings.service.ts',
  // Chats connected before telegram_workspace_id was recorded.
  'modules/telegram/telegram.service.ts',
  'common/utils/seed-demo.util.ts',
  // Account security events (password, 2FA, email, data export) belong to the
  // user rather than a workspace; the audit log files them under the home one.
  'modules/auth/password-reset.service.ts',
  'modules/auth/two-factor.service.ts',
  'modules/users/services/account-data.service.ts',
  'modules/users/services/email-change.service.ts',
]);

const SRC = path.join(process.cwd(), 'src');
const READ = /\buser\??\.workspaceId\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'migrations' ? [] : sourceFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

describe('user.workspaceId reads', () => {
  it('stay in the files that manage the registration workspace', () => {
    const offenders = sourceFiles(SRC)
      .map(file => path.relative(SRC, file).split(path.sep).join('/'))
      .filter(file => !ALLOWED.has(file))
      .flatMap(file =>
        readFileSync(path.join(SRC, file), 'utf8')
          .split('\n')
          .map((line, index) => ({ file, line: index + 1, text: line.trim() }))
          .filter(({ text }) => READ.test(text)),
      );

    expect(offenders).toEqual([]);
  });
});
