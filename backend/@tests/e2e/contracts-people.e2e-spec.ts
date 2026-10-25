vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Schema } from 'effect';
import { generateSync } from 'otplib';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  AdminUser,
  DisclaimerAccepted,
  EmailChangeConfirmed,
  InvitationAccepted,
  InvitationSent,
  MemberPermissionsUpdated,
  MemberRoleUpdated,
  MessageResult,
  TimeZoneList,
  UserPermissionsUpdate,
  UserProfile,
  UserUpdateResponse,
  WorkspaceInvitationList,
  WorkspaceSummary,
} from '../../src/contracts';
import { PasswordResetService } from '../../src/modules/auth/password-reset.service';
import { EmailChangeService } from '../../src/modules/users/services/email-change.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
  responseCookie,
} from './helpers/e2e-app';

const PASSWORD = 'Test123!@#';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** People, workspaces and auth: every answer checked against its contract, with data. */
describe('API contracts: people (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emailOf = (who: string) => `contracts-people-${who}-${stamp}@example.com`;
  const emails: string[] = [];
  let owner: E2eAccount;
  let member: E2eAccount;

  const register = async (who: string) => {
    emails.push(emailOf(who));
    return registerAccount(app, emailOf(who), `Member ${who}`);
  };
  const as = (account: E2eAccount, method: Method, url: string, body?: object) => {
    const req = request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${account.token}`)
      .set('x-workspace-id', account.workspaceId);
    return body ? req.send(body) : req;
  };
  const ok = (res: request.Response) => {
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`${res.status}: ${JSON.stringify(res.body)}`);
    }
  };
  const answer = async (schema: Schema.Top, pending: request.Test) => {
    const res = await pending.expect(ok);
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>)(res.body);
    return res.body;
  };

  beforeAll(async () => {
    const moduleFixture = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await register('owner');
    member = await register('member');
    // The instance admin, who may delete users.
    await dataSource.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [owner.userId]);
  });

  afterAll(async () => {
    for (const email of emails) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it('own profile', async () => {
    await answer(UserProfile, as(owner, 'get', '/users/me'));
    const zones = await answer(TimeZoneList, as(owner, 'get', '/users/timezones'));
    expect(zones.timeZones.length).toBeGreaterThan(0);
    await answer(UserUpdateResponse, as(owner, 'patch', '/users/me/onboarding', { locale: 'en' }));
    await answer(DisclaimerAccepted, as(owner, 'post', '/users/me/disclaimer'));
    await answer(
      UserUpdateResponse,
      as(owner, 'post', '/users/me/avatar').attach('avatar', PNG, 'face.png'),
    );
    await answer(AdminUser, as(owner, 'get', `/users/${owner.userId}`));
    await answer(AdminUser, as(owner, 'put', `/users/${owner.userId}`, { name: 'Owner Renamed' }));
  });

  it('email change, then the account deleted', async () => {
    const mover = await register('mover');
    const next = emailOf('moved');
    emails.push(next);
    await as(mover, 'patch', '/users/me/email', { email: next, currentPassword: PASSWORD }).expect(
      ok,
    );
    const token = randomUUID();
    const service = app.get(EmailChangeService);
    await dataSource.query('UPDATE email_change_tokens SET token_hash = $1 WHERE user_id = $2', [
      service['hashToken'](token),
      mover.userId,
    ]);
    const confirmed = await answer(
      EmailChangeConfirmed,
      request(app.getHttpServer()).post('/users/me/email/confirm').send({ token }),
    );
    expect(confirmed.email).toBe(next);
    // The only owner of a workspace cannot leave it behind.
    await as(mover, 'delete', `/workspaces/${mover.workspaceId}`).expect(ok);
    await answer(MessageResult, as(mover, 'delete', '/users/me', { currentPassword: PASSWORD }));
  });

  it('password reset, sessions and logouts', async () => {
    const resetter = await register('resetter');
    const auth = () => request(app.getHttpServer()).post('/auth/forgot-password');
    await answer(MessageResult, auth().send({ email: resetter.email }));
    const token = randomUUID();
    await dataSource.query('UPDATE password_reset_tokens SET token_hash = $1 WHERE user_id = $2', [
      app.get(PasswordResetService)['hashToken'](token),
      resetter.userId,
    ]);
    await answer(
      MessageResult,
      request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: PASSWORD }),
    );
    const login = async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: resetter.email, password: PASSWORD })
        .expect(ok);
      const access = responseCookie(res, 'access_token') ?? '';
      return { ...resetter, token: access, refresh: responseCookie(res, 'refresh_token') ?? '' };
    };
    const first = await login();
    const second = await login();
    await answer(
      MessageResult,
      request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${first.refresh}`),
    );
    const sessions = await as(second, 'get', '/auth/sessions').expect(ok);
    const other = sessions.body.find((session: { isCurrent?: boolean }) => !session.isCurrent);
    await answer(MessageResult, as(second, 'post', `/auth/sessions/${other.id}/logout`));
    await answer(MessageResult, as(second, 'post', '/auth/logout'));
    await answer(MessageResult, as(await login(), 'post', '/auth/logout-all'));
  });

  it('two-factor disable', async () => {
    const guarded = await register('guarded');
    const setup = await as(guarded, 'post', '/auth/2fa/setup', { password: PASSWORD }).expect(ok);
    await as(guarded, 'post', '/auth/2fa/enable', {
      code: generateSync({ secret: setup.body.secret }),
    }).expect(ok);
    await answer(MessageResult, as(guarded, 'post', '/auth/2fa/disable', { password: PASSWORD }));
  });

  it('members, invitations and user permissions', async () => {
    const ws = `/workspaces/${owner.workspaceId}`;
    const sent = await answer(
      InvitationSent,
      as(owner, 'post', `${ws}/invitations`, { email: member.email, role: 'member' }),
    );
    const pending = await answer(WorkspaceInvitationList, as(owner, 'get', `${ws}/invitations`));
    expect(pending.length).toBeGreaterThan(0);
    await answer(
      InvitationAccepted,
      as(member, 'post', '/workspaces/invitations/accept', { token: sent.invitation.token }),
    );
    await answer(
      MemberPermissionsUpdated,
      as(owner, 'patch', `${ws}/members/${member.userId}/permissions`, {
        permissions: { canEditCategories: true },
      }),
    );
    await answer(
      MemberRoleUpdated,
      as(owner, 'patch', `${ws}/members/${member.userId}/role`, { role: 'admin' }),
    );
    const users = `/users/${member.userId}/permissions`;
    const permission = { permission: 'statement.view' };
    const updated = await answer(
      UserPermissionsUpdate,
      as(owner, 'put', users, { permissions: ['statement.view'] }),
    );
    expect(updated.permissions).toEqual(['statement.view']);
    await answer(UserPermissionsUpdate, as(owner, 'post', `${users}/remove`, permission));
    await answer(UserPermissionsUpdate, as(owner, 'post', `${users}/add`, permission));
    await answer(UserPermissionsUpdate, as(owner, 'post', `${users}/reset`));

    const late = await register('late');
    const legacy = await answer(
      InvitationSent,
      as(owner, 'post', '/workspaces/invitations', { email: late.email }),
    );
    await answer(MessageResult, as(owner, 'delete', `${ws}/invitations/${legacy.invitation.id}`));
    const again = await answer(
      InvitationSent,
      as(owner, 'post', `${ws}/invitations`, { email: late.email }),
    );
    await as(late, 'post', `/workspaces/invitations/${again.invitation.token}/accept`).expect(ok);
    await answer(MessageResult, as(owner, 'delete', `/workspaces/members/${late.userId}`));
    await answer(MessageResult, as(owner, 'delete', `${ws}/members/${member.userId}`));
    await answer(MessageResult, as(owner, 'delete', `/users/${late.userId}`));
  });

  it('workspace update, switch and delete', async () => {
    const ws = `/workspaces/${owner.workspaceId}`;
    await answer(WorkspaceSummary, as(owner, 'patch', ws, { name: 'People Contracts' }));
    const spare = await as(owner, 'post', '/workspaces', { name: 'Spare' }).expect(ok);
    await answer(MessageResult, as(owner, 'post', `/workspaces/${spare.body.id}/switch`));
    await answer(MessageResult, as(owner, 'post', `${ws}/switch`));
    await answer(MessageResult, as(owner, 'delete', `/workspaces/${spare.body.id}`));
  });
});
