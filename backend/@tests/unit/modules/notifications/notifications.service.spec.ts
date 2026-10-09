import {
  Notification,
  NotificationCategory,
  NotificationPreference,
  NotificationSeverity,
  NotificationType,
  User,
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
});
