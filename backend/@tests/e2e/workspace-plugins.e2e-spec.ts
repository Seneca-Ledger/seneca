jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { WebhookDelivery } from '../../src/entities/webhook-delivery.entity';
import {
  WebhookEvent,
  WebhookSubscription,
} from '../../src/entities/webhook-subscription.entity';
import { WorkspaceMember, WorkspaceRole } from '../../src/entities/workspace-member.entity';
import { WebhookDispatcherService } from '../../src/modules/webhooks/services/webhook-dispatcher.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Plugin switches live on the workspace: only owners and admins flip them, and
 * a workspace with webhooks off neither accepts inbound uploads nor queues
 * outbound deliveries.
 */
describe('Workspace plugin switches (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `plugins-owner-${stamp}@example.com`,
    member: `plugins-member-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let member: E2eAccount;
  let inboundToken: string;
  let subscriptionId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const setPlugins = (account: E2eAccount, plugins: Record<string, boolean>) =>
    as(account, request(server()).patch(`/workspaces/${owner.workspaceId}`)).send({ plugins });
  const pluginsOf = async (): Promise<Record<string, boolean>> => {
    const res = await as(owner, request(server()).get('/workspaces')).expect(200);
    const list = Array.isArray(res.body) ? res.body : res.body.data;
    return list.find((w: { id: string }) => w.id === owner.workspaceId).settings?.plugins;
  };
  const deliveriesOf = () =>
    dataSource.getRepository(WebhookDelivery).count({ where: { subscriptionId } });
  const dispatch = () =>
    app
      .get(WebhookDispatcherService)
      .dispatch(owner.workspaceId, WebhookEvent.STATEMENT_PROCESSED, { test: true });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Plugins Owner');
    member = await registerAccount(app, emails.member, 'Plugins Member');
    await dataSource.getRepository(WorkspaceMember).save({
      workspaceId: owner.workspaceId,
      userId: member.userId,
      role: WorkspaceRole.MEMBER,
    });

    const endpoint = await as(owner, request(server()).post('/webhook-endpoints'))
      .send({ name: 'Scanner' })
      .expect(201);
    inboundToken = endpoint.body.token;

    // Saved directly: creating one through the API resolves the URL in DNS.
    const subscription = await dataSource.getRepository(WebhookSubscription).save({
      workspaceId: owner.workspaceId,
      name: 'Receiver',
      url: 'https://example.com/hook',
      secret: 'a-secret-of-at-least-16',
      events: [WebhookEvent.STATEMENT_PROCESSED],
      isActive: true,
    });
    subscriptionId = subscription.id;
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query('DELETE FROM webhook_subscriptions WHERE workspace_id = $1', [
        owner.workspaceId,
      ]);
      await dataSource.query('DELETE FROM webhook_endpoints WHERE workspace_id = $1', [
        owner.workspaceId,
      ]);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('starts a new workspace with every plugin off', async () => {
    expect((await pluginsOf()) ?? {}).not.toMatchObject({ webhooks: true });
  });

  it('refuses inbound uploads and queues nothing while webhooks are off', async () => {
    const res = await request(server())
      .post(`/webhooks/${inboundToken}/statements`)
      .send({})
      .expect(403);
    expect(res.body.error?.code ?? res.body.code).toBe('PLUGIN_DISABLED');

    await dispatch();
    expect(await deliveriesOf()).toBe(0);
  });

  it('lets only owners and admins flip a switch', async () => {
    await setPlugins(member, { webhooks: true }).expect(403);
    await setPlugins(owner, { webhooks: true }).expect(200);

    expect(await pluginsOf()).toEqual({ webhooks: true, mcp: false, aiAssistant: false });
  });

  it('keeps the other switches and the processing settings when one changes', async () => {
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ processing: { merchantLearning: false }, plugins: { mcp: true } })
      .expect(200);

    const res = await as(owner, request(server()).get('/workspaces')).expect(200);
    const list = Array.isArray(res.body) ? res.body : res.body.data;
    const settings = list.find((w: { id: string }) => w.id === owner.workspaceId).settings;
    expect(settings.plugins).toEqual({ webhooks: true, mcp: true, aiAssistant: false });
    expect(settings.processing.merchantLearning).toBe(false);
  });

  it('accepts inbound uploads and queues deliveries once webhooks are on', async () => {
    // Past the switch: the request is refused for having no file, not for the plugin.
    await request(server()).post(`/webhooks/${inboundToken}/statements`).send({}).expect(400);

    await dispatch();
    expect(await deliveriesOf()).toBe(1);
  });
});
