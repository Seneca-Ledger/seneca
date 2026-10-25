import { NotificationType } from '../../../../src/entities/notification.entity';
import { NotificationEventsListener } from '../../../../src/modules/notifications/notification-events.listener';

describe('NotificationEventsListener — tax deadlines', () => {
  const notificationsService = {
    removeForWorkspace: vi.fn(async () => 1),
    createForWorkspaceMembers: vi.fn(async () => 1),
  };
  const listener = new NotificationEventsListener(notificationsService as never);
  const types = [NotificationType.TAX_DEADLINE_UPCOMING, NotificationType.TAX_DEADLINE_OVERDUE];
  const q3 = {
    workspaceId: 'ws-1',
    kind: 'vat_return' as const,
    periodStart: '2026-07-01',
    periodEnd: '2026-09-30',
    dueDate: '2026-10-12',
    returnName: 'Umsatzsteuer-Voranmeldung',
  };

  beforeEach(() => vi.clearAllMocks());

  it('removes the due-soon reminder for the period before the overdue one goes out', async () => {
    await listener.onTaxDeadlineUpcoming({ ...q3, daysLeft: -1 });

    expect(notificationsService.removeForWorkspace).toHaveBeenCalledWith('ws-1', types, {
      kind: 'vat_return',
      dueDate: '2026-10-12',
    });
    expect(notificationsService.removeForWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      notificationsService.createForWorkspaceMembers.mock.invocationCallOrder[0],
    );
    expect(notificationsService.createForWorkspaceMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.TAX_DEADLINE_OVERDUE,
        messageKey: 'tax.deadline.vat.overdue',
        meta: expect.objectContaining({ kind: 'vat_return', periodEnd: '2026-09-30' }),
      }),
    );
  });

  it('removes both reminders for a period once its return is filed', async () => {
    await listener.onTaxDeadlineResolved({
      workspaceId: 'ws-1',
      kind: 'vat_return',
      periodEnd: '2026-09-30',
    });

    expect(notificationsService.removeForWorkspace).toHaveBeenCalledWith('ws-1', types, {
      kind: 'vat_return',
      periodEnd: '2026-09-30',
    });
    expect(notificationsService.createForWorkspaceMembers).not.toHaveBeenCalled();
  });
});
