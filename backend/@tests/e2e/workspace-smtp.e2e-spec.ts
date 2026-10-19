jest.mock('franc', () => ({
  franc: () => 'und',
}));

// No mail leaves the test: the transport records which server it was built for.
jest.mock('nodemailer', () => {
  const sendMail = jest.fn(async () => ({ messageId: 'test' }));
  return {
    createTransport: jest.fn(() => ({ sendMail, verify: jest.fn(async () => true) })),
    sendMail,
  };
});
// The invitation template is TSX, which the e2e transform does not compile;
// its content is not what this spec is about.
jest.mock('../../src/emails/workspace-invitation.email', () => ({
  WorkspaceInvitationEmail: () => null,
  workspaceInvitationEmailText: () => 'invitation',
}));
jest.mock('@react-email/render', () => ({ render: async () => '<p>invitation</p>' }));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const { createTransport: mockCreateTransport, sendMail: mockSendMail } = jest.requireMock<{
  createTransport: jest.Mock;
  sendMail: jest.Mock;
}>('nodemailer');

/**
 * Mail about a workspace goes through that workspace's SMTP server. The user
 * owns A (their home workspace, with its own SMTP) and is an admin of B (with
 * another SMTP) and acts in B: A's server, credentials and public URL must not
 * be used for B's mail.
 */
describe('Workspace SMTP selection (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    member: `smtp-member-${stamp}@example.com`,
    owner: `smtp-owner-${stamp}@example.com`,
  };
  /** Home workspace A is `member.workspaceId`; B is `owner.workspaceId`. */
  let member: E2eAccount;
  let owner: E2eAccount;
  const smtpA = { host: '1.1.1.1', from: 'a@home.example' };
  const smtpB = { host: '8.8.8.8', from: 'b@company.example' };

  const inB = (req: request.Test) =>
    req.set('Authorization', `Bearer ${member.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const day = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  async function saveSettings(workspaceId: string, key: string, config: object, by: string) {
    await dataSource.query(
      `INSERT INTO workspace_service_settings (workspace_id, key, config, updated_by_user_id)
       VALUES ($1, $2, $3, $4)`,
      [workspaceId, key, JSON.stringify(config), by],
    );
  }

  const lastTransportHost = () => (mockCreateTransport.mock.calls.at(-1) as unknown[])[0];
  const lastMail = () => (mockSendMail.mock.calls.at(-1) as unknown[])[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    member = await registerAccount(app, emails.member, 'SMTP Member');
    owner = await registerAccount(app, emails.owner, 'SMTP Owner');

    const invite = await request(server())
      .post(`/workspaces/${owner.workspaceId}/invitations`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .send({ email: member.email, role: 'admin' })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);

    await saveSettings(member.workspaceId, 'smtp', { port: 587, ...smtpA }, member.userId);
    await saveSettings(owner.workspaceId, 'smtp', { port: 587, ...smtpB }, owner.userId);
    await saveSettings(
      member.workspaceId,
      'app',
      { publicUrl: 'https://a.example' },
      member.userId,
    );
    await saveSettings(owner.workspaceId, 'app', { publicUrl: 'https://b.example' }, owner.userId);
  });

  beforeEach(() => {
    mockCreateTransport.mockClear();
    mockSendMail.mockClear();
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it("sends B's invoice reminder through B's server", async () => {
    const client = await inB(request(server()).post('/clients'))
      .send({ name: 'Acme', email: 'billing@acme.example' })
      .expect(201);
    const invoice = await inB(request(server()).post('/invoices'))
      .send({
        clientId: client.body.id,
        issueDate: day(-10),
        dueDate: day(-1),
        currency: 'EUR',
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 300 }],
      })
      .expect(201);
    await inB(request(server()).put('/business-profile'))
      .send({ legalName: 'Company B', addressLines: '1 Main St' })
      .expect(200);
    await inB(request(server()).put(`/invoices/${invoice.body.id}/send`)).expect(200);
    mockCreateTransport.mockClear();
    mockSendMail.mockClear();

    const res = await inB(request(server()).post(`/invoices/${invoice.body.id}/remind`)).expect(
      200,
    );

    expect(res.body).toMatchObject({ sent: true, to: 'billing@acme.example' });
    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(lastTransportHost()).toMatchObject({ host: smtpB.host });
    expect(lastMail()).toMatchObject({ from: smtpB.from, to: 'billing@acme.example' });
  });

  it("sends B's invitation through B's server with B's public URL", async () => {
    const res = await inB(request(server()).post(`/workspaces/${owner.workspaceId}/invitations`))
      .send({ email: `smtp-invitee-${stamp}@example.com`, role: 'member' })
      .expect(201);

    expect(res.body.invitationLink).toMatch(/^https:\/\/b\.example\/invite\//);
    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(lastTransportHost()).toMatchObject({ host: smtpB.host });
    expect(lastMail()).toMatchObject({ from: smtpB.from });
  });
});
