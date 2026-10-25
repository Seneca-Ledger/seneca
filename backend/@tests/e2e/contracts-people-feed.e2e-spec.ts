vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  ApiKeyList,
  ApiKeyScopes,
  AuditEvent,
  AuditEventList,
  BusinessProfileLogoCleared,
  CreatedApiKey,
  HealthStatus,
  MessageResult,
  NotificationPreferences,
  ReadinessStatus,
  SystemUpdateStatus,
} from '../../src/contracts';
import {
  InsightSummary,
  InsightsRefreshed,
  UpdatedCount,
} from '../../src/contracts/feed/feed-answers';
import {
  ActorType,
  AuditAction,
  AuditEvent as AuditEventRow,
  EntityType,
} from '../../src/entities/audit-event.entity';
import { Insight, InsightCategory, InsightType } from '../../src/entities/insight.entity';
import {
  Notification,
  NotificationCategory,
  NotificationType,
} from '../../src/entities/notification.entity';
import { type ContractApp, seedManualExpense, startContractApp } from './helpers/contract-app';
import { deleteUserByEmail } from './helpers/e2e-app';

const succeeded = (res: request.Response) => {
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`${res.status}: ${JSON.stringify(res.body)}`);
  }
};
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/** The owner's feed, keys, audit trail and instance status: answers checked with data. */
describe('API contracts: people feed (e2e)', () => {
  const email = `contracts-people-feed-${Date.now()}@example.com`;
  let ctx: ContractApp;
  const call: ContractApp['call'] = (...args) => ctx.call(...args);
  const answer: ContractApp['answer'] = (schema, pending) => ctx.answer(schema, pending);

  beforeAll(async () => {
    ctx = await startContractApp(email, 'Member Owner');
    // The instance admin reads the update status.
    await ctx.dataSource.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [ctx.owner.userId]);
    await seedManualExpense(ctx, 'ACME Store - Wireless Buds');
  });

  afterAll(async () => {
    await deleteUserByEmail(ctx.dataSource, email);
    await ctx.app.close();
  });

  it('health', async () => {
    await answer(HealthStatus, request(ctx.app.getHttpServer()).get('/health'));
    await answer(ReadinessStatus, request(ctx.app.getHttpServer()).get('/health/ready'));
  });

  it('api keys', async () => {
    const body = { name: 'Contracts key', scopes: ['transaction.view'] };
    const created = await answer(CreatedApiKey, call('post', '/api-keys', body));
    expect(created.key).toBeTruthy();
    const keys = await answer(ApiKeyList, call('get', '/api-keys'));
    expect(keys.length).toBeGreaterThan(0);
    await answer(ApiKeyScopes, call('get', '/api-keys/scopes'));
  });

  it('notifications', async () => {
    const saved = await ctx.dataSource.getRepository(Notification).save({
      recipientId: ctx.owner.userId,
      workspaceId: ctx.owner.workspaceId,
      type: NotificationType.CATEGORY_CREATED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      title: 'Category created',
      message: 'Groceries was added',
    });
    const read = await answer(UpdatedCount, call('post', '/notifications/mark-read', { ids: [saved.id] }));
    expect(read.updated).toBe(1);
    await answer(UpdatedCount, call('post', '/notifications/mark-all-read'));
    await answer(NotificationPreferences, call('patch', '/notifications/preferences', {}));
  });

  it('insights', async () => {
    const saved = await ctx.dataSource.getRepository(Insight).save({
      userId: ctx.owner.userId,
      workspaceId: ctx.owner.workspaceId,
      type: InsightType.SPENDING_SPIKE,
      category: InsightCategory.ANOMALY,
      title: 'Spending spike',
      message: 'More than usual this week',
    });
    const summary = await answer(InsightSummary, call('get', '/insights/summary'));
    expect(summary.total).toBeGreaterThan(0);
    await answer(InsightsRefreshed, call('post', '/insights/refresh?locale=en'));
    const dismissed = await answer(UpdatedCount, call('post', `/insights/${saved.id}/dismiss`));
    expect(dismissed.updated).toBe(1);
    await answer(UpdatedCount, call('post', '/insights/dismiss-all'));
  });

  it('audit events by batch and by id, notes, logo, system update', async () => {
    const batchId = randomUUID();
    const event = await ctx.dataSource.getRepository(AuditEventRow).save({
      workspaceId: ctx.owner.workspaceId,
      actorType: ActorType.USER,
      actorId: ctx.owner.userId,
      actorLabel: 'Member owner',
      entityType: EntityType.CATEGORY,
      entityId: randomUUID(),
      action: AuditAction.IMPORT,
      batchId,
    });
    const batch = await answer(AuditEventList, call('get', `/audit-events/batch/${batchId}`));
    expect(batch.length).toBe(1);
    await answer(AuditEvent, call('get', `/audit-events/${event.id}`));

    const rows = await call('get', '/transactions').expect(succeeded);
    const note = await call('post', '/notes', {
      entityType: 'transaction',
      entityId: rows.body.data[0].id,
      body: 'Checked',
    }).expect(succeeded);
    await answer(MessageResult, call('delete', `/notes/${note.body.id}`));

    await call('post', '/business-profile/logo').attach('logo', PNG, 'logo.png').expect(succeeded);
    await answer(BusinessProfileLogoCleared, call('delete', '/business-profile/logo'));
    await answer(SystemUpdateStatus, call('get', '/system/update'));
  }, 30_000);
});
