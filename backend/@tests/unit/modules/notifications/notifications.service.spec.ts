import {
  Notification,
  NotificationCategory,
  NotificationPreference,
  NotificationSeverity,
  NotificationType,
  User,
  Workspace,
  WorkspaceKind,
  WorkspaceMember,
} from '../../../../src/entities';
import { NotificationsService } from '../../../../src/modules/notifications/notifications.service';

function createRepoMock<T>() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data: Partial<T>) => data as T),
    save: jest.fn(async (data: Partial<T>) => data as T),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(),
    // Asked whether the workspace is a past version; an ordinary one by default.
    manager: { exists: jest.fn(async () => false) },
  } as any;
}

function createQueryBuilderMock() {
  const qb: any = {
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    take: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    getManyAndCount: jest.fn(async () => [[], 0]),
    getCount: jest.fn(async () => 0),
    update: jest.fn(() => qb),
    set: jest.fn(() => qb),
    execute: jest.fn(async () => ({ affected: 0 })),
  };
  return qb;
}

describe('NotificationsService', () => {
  const notificationRepository = createRepoMock<Notification>();
  const preferenceRepository = createRepoMock<NotificationPreference>();
  const userRepository = createRepoMock<User>();
  const workspaceMemberRepository = createRepoMock<WorkspaceMember>();
  const eventEmitter = { emit: jest.fn() };

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findOne.mockResolvedValue({ id: 'user-1', locale: 'en' } as User);
    service = new NotificationsService(
      notificationRepository,
      preferenceRepository,
      userRepository,
      workspaceMemberRepository,
      eventEmitter as any,
    );
  });

  it('creates notification when preference is enabled', async () => {
    preferenceRepository.findOne.mockResolvedValue({
      userId: 'user-1',
      statementUploaded: true,
    } as NotificationPreference);

    notificationRepository.save.mockResolvedValue({
      id: 'notification-1',
      recipientId: 'user-1',
      type: NotificationType.STATEMENT_UPLOADED,
    } as Notification);

    const result = await service.create({
      recipientId: 'user-1',
      workspaceId: 'workspace-1',
      type: NotificationType.STATEMENT_UPLOADED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity: NotificationSeverity.INFO,
      messageKey: 'statement.uploaded',
      messageParams: { actorName: 'Alice', statementName: 'Jan 2026' },
    });

    expect(result?.id).toBe('notification-1');
    expect(notificationRepository.save).toHaveBeenCalledTimes(1);
    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Statement uploaded',
        message: 'Alice uploaded statement "Jan 2026"',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'notification.created',
      expect.objectContaining({ id: 'notification-1' }),
    );
  });

  it('renders notification in user locale (ru)', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1', locale: 'ru' } as User);
    preferenceRepository.findOne.mockResolvedValue({
      userId: 'user-1',
      statementUploaded: true,
    } as NotificationPreference);

    notificationRepository.save.mockResolvedValue({ id: 'n-1' } as Notification);

    await service.create({
      recipientId: 'user-1',
      workspaceId: 'workspace-1',
      type: NotificationType.STATEMENT_UPLOADED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      messageKey: 'statement.uploaded',
      messageParams: { actorName: 'Алиса', statementName: 'Январь' },
    });

    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Загружена выписка',
        message: 'Алиса загрузил(а) выписку "Январь"',
      }),
    );
  });

  it('does not create notification when preference is disabled', async () => {
    preferenceRepository.findOne.mockResolvedValue({
      userId: 'user-1',
      statementUploaded: false,
    } as NotificationPreference);

    const result = await service.create({
      recipientId: 'user-1',
      type: NotificationType.STATEMENT_UPLOADED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      messageKey: 'statement.uploaded',
      messageParams: { actorName: 'Alice', statementName: 'test' },
    });

    expect(result).toBeNull();
    expect(notificationRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('creates default preferences when user has none', async () => {
    preferenceRepository.findOne.mockResolvedValue(null);
    preferenceRepository.save.mockResolvedValue({
      id: 'pref-1',
      userId: 'user-1',
      statementUploaded: true,
      importCommitted: true,
      categoryChanges: true,
      memberActivity: true,
      dataDeleted: true,
      workspaceUpdated: true,
      parsingErrors: true,
      importFailures: true,
      uncategorizedItems: true,
    } as NotificationPreference);

    const prefs = await service.getPreferences('user-1');

    expect(preferenceRepository.create).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(preferenceRepository.save).toHaveBeenCalledTimes(1);
    expect(prefs.id).toBe('pref-1');
  });

  it('leaves a setting as it is on null, but turns quiet hours off with it', async () => {
    preferenceRepository.findOne.mockResolvedValue({
      id: 'pref-1',
      userId: 'user-1',
      categoryChanges: true,
      digestMode: 'daily',
      quietHoursStart: 22,
      quietHoursEnd: 7,
      channels: { categoryChanges: { inApp: true, email: false, telegram: false, push: false } },
    } as unknown as NotificationPreference);

    await service.updatePreferences('user-1', {
      categoryChanges: null,
      digestMode: null,
      quietHoursStart: null,
      quietHoursEnd: null,
    });

    expect(preferenceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryChanges: true,
        digestMode: 'daily',
        quietHoursStart: null,
        quietHoursEnd: null,
      }),
    );
  });

  it('creates notifications for workspace members except actor', async () => {
    workspaceMemberRepository.find.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-3' },
    ] as WorkspaceMember[]);

    const createSpy = jest.spyOn(service, 'create').mockResolvedValue({ id: 'n' } as Notification);

    const count = await service.createForWorkspaceMembers({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      actorName: 'Alice',
      type: NotificationType.CATEGORY_UPDATED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      messageKey: 'category.updated',
      messageParams: { actorName: 'Alice', categoryName: 'Food' },
    });

    expect(count).toBe(2);
    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(createSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ recipientId: 'user-2' }),
    );
    expect(createSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ recipientId: 'user-3' }),
    );
  });

  it('tells no one about a past version: it creates nothing, sends nothing, emits nothing', async () => {
    notificationRepository.manager.exists.mockResolvedValueOnce(true);

    const result = await service.create({
      recipientId: 'user-1',
      workspaceId: 'version-1',
      type: NotificationType.STATEMENT_UPLOADED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      messageKey: 'statement.uploaded',
      messageParams: { actorName: 'Alice', statementName: 'Jan 2026' },
    });

    expect(result).toBeNull();
    expect(notificationRepository.manager.exists).toHaveBeenCalledWith(Workspace, {
      where: { id: 'version-1', kind: WorkspaceKind.VERSION },
    });
    expect(preferenceRepository.findOne).not.toHaveBeenCalled();
    expect(notificationRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('tells no one about a demo workspace either', async () => {
    // Not a past version; a demo.
    notificationRepository.manager.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const result = await service.create({
      recipientId: 'user-1',
      workspaceId: 'demo-1',
      type: NotificationType.STATEMENT_UPLOADED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      messageKey: 'statement.uploaded',
      messageParams: { actorName: 'Alice', statementName: 'Jan 2026' },
    });

    expect(result).toBeNull();
    expect(notificationRepository.manager.exists).toHaveBeenLastCalledWith(Workspace, {
      where: { id: 'demo-1', demoOfUserId: expect.anything() },
    });
    expect(notificationRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('looks for members of an ordinary workspace only, so a past version has no one to tell', async () => {
    workspaceMemberRepository.find.mockResolvedValue([]);

    const count = await service.createForWorkspaceMembers({
      workspaceId: 'version-1',
      type: NotificationType.PAYABLE_OVERDUE,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      messageKey: 'payable.overdue',
      messageParams: { vendor: 'Acme', amount: '', dueDate: '' },
    });

    expect(count).toBe(0);
    expect(workspaceMemberRepository.find).toHaveBeenCalledWith({
      where: { workspaceId: 'version-1', workspace: { kind: WorkspaceKind.STANDARD } },
      select: { userId: true },
    });
  });

  it('requires workspaceId when listing and counting notifications', async () => {
    const listQb = createQueryBuilderMock();
    const countQb = createQueryBuilderMock();
    notificationRepository.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(countQb)
      .mockReturnValueOnce(createQueryBuilderMock());

    await service.findByRecipient('user-1', 'workspace-1', 30, 0);
    await service.getUnreadCount('user-1', 'workspace-1');
    await service.markAllAsRead('user-1', 'workspace-1');

    expect(listQb.andWhere).toHaveBeenCalledWith('notification.workspaceId = :workspaceId', {
      workspaceId: 'workspace-1',
    });
    expect(countQb.andWhere).toHaveBeenCalledWith('notification.workspaceId = :workspaceId', {
      workspaceId: 'workspace-1',
    });
  });

  it('hides notifications about trashed or deleted statements and receipts from the list and the count', async () => {
    const listQb = createQueryBuilderMock();
    const countQb = createQueryBuilderMock();
    notificationRepository.createQueryBuilder
      .mockReturnValueOnce(listQb)
      .mockReturnValueOnce(countQb);

    await service.findByRecipient('user-1', 'workspace-1', 30, 0);
    await service.getUnreadCount('user-1', 'workspace-1');

    for (const qb of [listQb, countQb]) {
      const clauses: string[] = qb.andWhere.mock.calls.map((call: unknown[]) => String(call[0]));
      const filter = clauses.find(clause => clause.includes('FROM statements'));
      expect(filter).toContain('s.deleted_at IS NULL');
      expect(filter).toContain('FROM receipts');
    }
  });

  describe('fingerprinted notifications (one running row per workspace)', () => {
    const upcoming = (items: Array<{ name: string; amount: number }>, fingerprint: string) => ({
      recipientId: 'user-1',
      workspaceId: 'workspace-1',
      type: NotificationType.SUBSCRIPTION_UPCOMING,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      messageKey: 'subscription.upcoming' as const,
      messageParams: {
        charges: {
          kind: 'charges' as const,
          items: items.map(item => ({ ...item, currency: 'EUR' })),
        },
      },
      fingerprint,
    });

    beforeEach(() => {
      preferenceRepository.findOne.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        workspaceUpdated: true,
      } as NotificationPreference);
    });

    it('rewrites the existing row instead of adding a second one when the charges change', async () => {
      const yesterday = new Date('2026-10-14T06:00:00Z');
      const existing = {
        id: 'n-1',
        recipientId: 'user-1',
        workspaceId: 'workspace-1',
        type: NotificationType.SUBSCRIPTION_UPCOMING,
        isRead: true,
        createdAt: yesterday,
        meta: { fingerprint: 'dropbox' },
      } as unknown as Notification;
      notificationRepository.find.mockResolvedValueOnce([existing]);

      const result = await service.create(
        upcoming(
          [
            { name: 'Dropbox', amount: 11.99 },
            { name: 'Adobe Creative Cloud', amount: 66.45 },
          ],
          'dropbox|adobe',
        ),
      );

      expect(notificationRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recipientId: 'user-1',
            workspaceId: 'workspace-1',
            type: NotificationType.SUBSCRIPTION_UPCOMING,
          },
        }),
      );
      expect(notificationRepository.save).not.toHaveBeenCalled();
      expect(notificationRepository.update).toHaveBeenCalledTimes(1);
      const [criteria, changes] = notificationRepository.update.mock.calls[0];
      expect(criteria).toEqual({ id: 'n-1', recipientId: 'user-1' });
      expect(changes).toMatchObject({
        isRead: false,
        message: 'Dropbox €11.99 and Adobe Creative Cloud €66.45 are due soon',
        meta: expect.objectContaining({ fingerprint: 'dropbox|adobe' }),
      });
      expect(changes.createdAt.getTime()).toBeGreaterThan(yesterday.getTime());
      expect(result?.id).toBe('n-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'notification.created',
        expect.objectContaining({ id: 'n-1' }),
      );
    });

    it('leaves the row alone, read state included, when nothing changed', async () => {
      const existing = {
        id: 'n-1',
        isRead: true,
        meta: { fingerprint: 'dropbox' },
      } as unknown as Notification;
      notificationRepository.find.mockResolvedValueOnce([existing]);

      const result = await service.create(upcoming([{ name: 'Dropbox', amount: 11.99 }], 'dropbox'));

      expect(result).toBe(existing);
      expect(notificationRepository.update).not.toHaveBeenCalled();
      expect(notificationRepository.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('inserts the first one and clears older duplicates left by earlier runs', async () => {
      notificationRepository.find.mockResolvedValueOnce([]);
      await service.create(upcoming([{ name: 'Dropbox', amount: 11.99 }], 'dropbox'));
      expect(notificationRepository.save).toHaveBeenCalledTimes(1);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ meta: { fingerprint: 'dropbox' } }),
      );

      notificationRepository.find.mockResolvedValueOnce([
        { id: 'newest', meta: { fingerprint: 'dropbox' } },
        { id: 'older-1' },
        { id: 'older-2' },
      ]);
      await service.create(upcoming([{ name: 'Dropbox', amount: 11.99 }], 'dropbox'));
      expect(notificationRepository.delete).toHaveBeenCalledWith({
        recipientId: 'user-1',
        workspaceId: 'workspace-1',
        id: expect.objectContaining({ _value: ['older-1', 'older-2'] }),
      });
    });
  });

  it('removes stale reminders only inside the given workspace and types', async () => {
    const qb: any = {
      delete: jest.fn(() => qb),
      from: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      execute: jest.fn(async () => ({ affected: 2 })),
    };
    notificationRepository.createQueryBuilder.mockReturnValueOnce(qb);

    const removed = await service.removeForWorkspace(
      'workspace-1',
      [NotificationType.TAX_DEADLINE_UPCOMING],
      { kind: 'vat_return', periodEnd: '2026-09-30' },
    );

    expect(removed).toBe(2);
    expect(qb.where).toHaveBeenCalledWith('workspace_id = :workspaceId', {
      workspaceId: 'workspace-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('type IN (:...types)', {
      types: [NotificationType.TAX_DEADLINE_UPCOMING],
    });
    expect(qb.andWhere).toHaveBeenCalledWith('meta @> CAST(:match AS jsonb)', {
      match: JSON.stringify({ kind: 'vat_return', periodEnd: '2026-09-30' }),
    });
  });
});
