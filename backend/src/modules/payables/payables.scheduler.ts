import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntityType } from '../../entities/audit-event.entity';
import {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '../../entities/notification.entity';
import { type Payable, PayableDirection } from '../../entities/payable.entity';
import type { NotificationParams } from '../notifications/notification-params';
import { NotificationsService } from '../notifications/notifications.service';
import { PayablesService } from './payables.service';

/** What is still owed, to whom and by when — formatted in each recipient's locale. */
function payableParams(payable: Payable): NotificationParams {
  return {
    vendor: payable.vendor,
    amount: {
      kind: 'money',
      amount: Math.max(Number(payable.amount) - Number(payable.paidAmount ?? 0), 0),
      currency: payable.currency,
    },
    dueDate: payable.dueDate ? { kind: 'date', value: payable.dueDate } : '',
  };
}

@Injectable()
export class PayablesScheduler {
  private readonly logger = new Logger(PayablesScheduler.name);

  constructor(
    private readonly payablesService: PayablesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async processDailyPayables(): Promise<void> {
    try {
      const overduePayables = await this.payablesService.markOverduePayables();
      for (const payable of overduePayables) {
        // Receivables go overdue too, but 'payable.overdue' is the wrong thing to tell someone
        // about money owed *to* them — they get no notification until wording exists.
        if (payable.direction !== PayableDirection.PAYABLE) {
          continue;
        }
        try {
          await this.notificationsService.createForWorkspaceMembers({
            workspaceId: payable.workspaceId,
            type: NotificationType.PAYABLE_OVERDUE,
            category: NotificationCategory.WORKSPACE_ACTIVITY,
            severity: NotificationSeverity.WARN,
            messageKey: 'payable.overdue',
            messageParams: payableParams(payable),
            entityType: EntityType.PAYABLE,
            entityId: payable.id,
            meta: { payableId: payable.id, direction: payable.direction },
          });
        } catch (error) {
          this.logger.error(
            `Failed overdue notification for payable ${payable.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }

      const dueSoonPayables = await this.payablesService.findDueSoonPayables(3);
      for (const payable of dueSoonPayables) {
        try {
          await this.notificationsService.createForWorkspaceMembers({
            workspaceId: payable.workspaceId,
            type: NotificationType.PAYABLE_DUE_SOON,
            category: NotificationCategory.WORKSPACE_ACTIVITY,
            severity: NotificationSeverity.INFO,
            messageKey: 'payable.due_soon',
            messageParams: payableParams(payable),
            entityType: EntityType.PAYABLE,
            entityId: payable.id,
            meta: { payableId: payable.id, direction: payable.direction },
          });
          await this.payablesService.markDueSoonNotified(payable.id);
        } catch (error) {
          this.logger.error(
            `Failed due-soon notification for payable ${payable.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Failed to process payables scheduler',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
