import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '../../entities/notification.entity';
import type {
  CategoryChangedEvent,
  DataDeletedEvent,
  ImportCommittedEvent,
  ImportFailedEvent,
  MemberInvitedEvent,
  MemberJoinedEvent,
  NoteMentionedEvent,
  OfficialVatRatesChangedEvent,
  ParsingErrorEvent,
  ReceiptUncategorizedEvent,
  StatementUploadedEvent,
  TaxDeadlineUpcomingEvent,
  TaxThresholdReachedEvent,
  TransactionsUncategorizedEvent,
  WorkspaceUpdatedEvent,
} from './events/notification-events';
import type { NotificationMessageKey } from './notification-translations';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationEventsListener {
  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('statement.uploaded')
  async onStatementUploaded(event: StatementUploadedEvent): Promise<void> {
    await this.notificationsService.createForWorkspaceMembers({
      workspaceId: event.workspaceId,
      actorId: event.actorId,
      actorName: event.actorName,
      type: NotificationType.STATEMENT_UPLOADED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity: NotificationSeverity.INFO,
      messageKey: 'statement.uploaded',
      messageParams: { actorName: event.actorName, statementName: event.statementName },
      entityType: 'statement',
      entityId: event.statementId,
      meta: { bankName: event.bankName ?? null },
    });
  }

  /** Упоминание адресное: уведомляем только названных, а не весь воркспейс. */
  @OnEvent('note.mentioned')
  async onNoteMentioned(event: NoteMentionedEvent): Promise<void> {
    await Promise.all(
      event.mentionedUserIds.map(recipientId =>
        this.notificationsService.create({
          recipientId,
          workspaceId: event.workspaceId,
          actorId: event.actorId,
          actorName: event.actorName,
          type: NotificationType.NOTE_MENTIONED,
          category: NotificationCategory.WORKSPACE_ACTIVITY,
          severity: NotificationSeverity.INFO,
          messageKey: 'note.mentioned',
          messageParams: { actorName: event.actorName, excerpt: event.excerpt },
          entityType: event.entityType,
          entityId: event.entityId,
          meta: { noteId: event.noteId },
        }),
      ),
    );
  }

  @OnEvent('import.committed')
  async onImportCommitted(event: ImportCommittedEvent): Promise<void> {
    await this.notificationsService.createForWorkspaceMembers({
      workspaceId: event.workspaceId,
      actorId: event.actorId,
      actorName: event.actorName,
      type: NotificationType.IMPORT_COMMITTED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity: NotificationSeverity.INFO,
      messageKey: 'import.committed',
      messageParams: { actorName: event.actorName, transactionCount: event.transactionCount },
      entityType: 'statement',
      entityId: event.statementId,
      meta: { transactionCount: event.transactionCount },
    });
  }

  @OnEvent('category.changed')
  async onCategoryChanged(event: CategoryChangedEvent): Promise<void> {
    const actionConfig: Record<
      CategoryChangedEvent['action'],
      {
        type: NotificationType;
        messageKey: NotificationMessageKey;
        severity: NotificationSeverity;
      }
    > = {
      created: {
        type: NotificationType.CATEGORY_CREATED,
        messageKey: 'category.created',
        severity: NotificationSeverity.INFO,
      },
      updated: {
        type: NotificationType.CATEGORY_UPDATED,
        messageKey: 'category.updated',
        severity: NotificationSeverity.INFO,
      },
      deleted: {
        type: NotificationType.CATEGORY_DELETED,
        messageKey: 'category.deleted',
        severity: NotificationSeverity.WARN,
      },
    };

    const config = actionConfig[event.action];
    await this.notificationsService.createForWorkspaceMembers({
      workspaceId: event.workspaceId,
      actorId: event.actorId,
      actorName: event.actorName,
      type: config.type,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity: config.severity,
      messageKey: config.messageKey,
      messageParams: { actorName: event.actorName, categoryName: event.categoryName },
      entityType: 'category',
      entityId: event.categoryId,
    });
  }

  @OnEvent('member.invited')
  async onMemberInvited(event: MemberInvitedEvent): Promise<void> {
    await this.notificationsService.createForWorkspaceMembers({
      workspaceId: event.workspaceId,
      actorId: event.actorId,
      actorName: event.actorName,
      type: NotificationType.MEMBER_INVITED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity: NotificationSeverity.INFO,
      messageKey: 'member.invited',
      messageParams: { actorName: event.actorName, invitedEmail: event.invitedEmail },
      meta: {
        invitedEmail: event.invitedEmail,
        role: event.role,
      },
    });
  }

  @OnEvent('member.joined')
  async onMemberJoined(event: MemberJoinedEvent): Promise<void> {
    await this.notificationsService.createForWorkspaceMembers({
      workspaceId: event.workspaceId,
      actorId: event.memberId,
      actorName: event.memberName,
      type: NotificationType.MEMBER_JOINED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity: NotificationSeverity.INFO,
      messageKey: 'member.joined',
      messageParams: { memberName: event.memberName },
    });
  }

  @OnEvent('data.deleted')
  async onDataDeleted(event: DataDeletedEvent): Promise<void> {
    await this.notificationsService.createForWorkspaceMembers({
      workspaceId: event.workspaceId,
      actorId: event.actorId,
      actorName: event.actorName,
      type: NotificationType.DATA_DELETED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity: NotificationSeverity.WARN,
      messageKey: 'data.deleted',
      messageParams: { actorName: event.actorName, count: event.count },
      entityType: event.entityType,
      meta: {
        count: event.count,
        entityLabel: event.entityLabel ?? null,
      },
    });
  }

  @OnEvent('workspace.updated')
  async onWorkspaceUpdated(event: WorkspaceUpdatedEvent): Promise<void> {
    await this.notificationsService.createForWorkspaceMembers({
      workspaceId: event.workspaceId,
      actorId: event.actorId,
      actorName: event.actorName,
      type: NotificationType.WORKSPACE_UPDATED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity: NotificationSeverity.INFO,
      messageKey: 'workspace.updated',
      messageParams: { actorName: event.actorName },
      entityType: 'workspace',
      entityId: event.workspaceId,
      meta: {
        changedFields: event.changedFields,
      },
    });
  }

  @OnEvent('parsing.error')
  async onParsingError(event: ParsingErrorEvent): Promise<void> {
    await this.notificationsService.create({
      recipientId: event.userId,
      workspaceId: event.workspaceId,
      type: NotificationType.PARSING_ERROR,
      category: NotificationCategory.SYSTEM,
      severity: NotificationSeverity.ERROR,
      messageKey: event.statementName ? 'parsing.error.named' : 'parsing.error',
      messageParams: { statementName: event.statementName ?? '' },
      entityType: 'statement',
      entityId: event.statementId ?? null,
      meta: {
        errorMessage: event.errorMessage,
      },
    });
  }

  @OnEvent('import.failed')
  async onImportFailed(event: ImportFailedEvent): Promise<void> {
    await this.notificationsService.create({
      recipientId: event.userId,
      workspaceId: event.workspaceId,
      type: NotificationType.IMPORT_FAILED,
      category: NotificationCategory.SYSTEM,
      severity: NotificationSeverity.ERROR,
      messageKey: event.statementName ? 'import.failed.named' : 'import.failed',
      messageParams: { statementName: event.statementName ?? '' },
      entityType: 'statement',
      entityId: event.statementId ?? null,
      meta: {
        errorMessage: event.errorMessage,
      },
    });
  }

  @OnEvent('transactions.uncategorized')
  async onTransactionsUncategorized(event: TransactionsUncategorizedEvent): Promise<void> {
    await this.notificationsService.create({
      recipientId: event.userId,
      workspaceId: event.workspaceId,
      type: NotificationType.TRANSACTION_UNCATEGORIZED,
      category: NotificationCategory.SYSTEM,
      severity: NotificationSeverity.WARN,
      messageKey: 'transactions.uncategorized',
      messageParams: { count: event.count },
      entityType: 'statement',
      entityId: event.statementId ?? null,
      meta: {
        count: event.count,
      },
    });
  }

  @OnEvent('receipt.uncategorized')
  async onReceiptUncategorized(event: ReceiptUncategorizedEvent): Promise<void> {
    await this.notificationsService.create({
      recipientId: event.userId,
      workspaceId: event.workspaceId,
      type: NotificationType.RECEIPT_UNCATEGORIZED,
      category: NotificationCategory.SYSTEM,
      severity: NotificationSeverity.WARN,
      messageKey: event.receiptName ? 'receipt.uncategorized.named' : 'receipt.uncategorized',
      messageParams: { receiptName: event.receiptName ?? '' },
      entityType: 'receipt',
      entityId: event.receiptId ?? null,
    });
  }

  @OnEvent('tax.threshold.reached')
  async onTaxThresholdReached(event: TaxThresholdReachedEvent): Promise<void> {
    const isBreach = event.level >= 100;

    await this.notificationsService.createForWorkspaceMembers({
      workspaceId: event.workspaceId,
      type: isBreach
        ? NotificationType.TAX_THRESHOLD_REACHED
        : NotificationType.TAX_THRESHOLD_WARNING,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity: isBreach ? NotificationSeverity.ERROR : NotificationSeverity.WARN,
      messageKey: (isBreach
        ? 'tax.threshold.reached'
        : 'tax.threshold.warning') as NotificationMessageKey,
      messageParams: {
        percentUsed: event.percentUsed,
        threshold: event.threshold,
        currency: event.currency,
      },
      entityType: 'workspace',
      entityId: event.workspaceId,
      meta: {
        turnover: event.turnover,
        threshold: event.threshold,
        currency: event.currency,
        percentUsed: event.percentUsed,
        periodStart: event.periodStart,
        periodEnd: event.periodEnd,
      },
    });
  }

  @OnEvent('tax.rates.official_changed')
  async onOfficialVatRatesChanged(event: OfficialVatRatesChangedEvent): Promise<void> {
    await this.notificationsService.createForWorkspaceMembers({
      workspaceId: event.workspaceId,
      type: NotificationType.TAX_RATES_OFFICIAL_CHANGED,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity: NotificationSeverity.WARN,
      messageKey: 'tax.rates.official',
      messageParams: { country: event.country, count: event.count },
      entityType: 'workspace',
      entityId: event.workspaceId,
      meta: { country: event.country, count: event.count },
    });
  }

  @OnEvent('tax.deadline.upcoming')
  async onTaxDeadlineUpcoming(event: TaxDeadlineUpcomingEvent): Promise<void> {
    const overdue = event.daysLeft < 0;
    const messageKey = (
      event.kind === 'vat_return'
        ? overdue
          ? 'tax.deadline.vat.overdue'
          : 'tax.deadline.vat'
        : 'tax.deadline.income'
    ) as NotificationMessageKey;

    await this.notificationsService.createForWorkspaceMembers({
      workspaceId: event.workspaceId,
      type: overdue
        ? NotificationType.TAX_DEADLINE_OVERDUE
        : NotificationType.TAX_DEADLINE_UPCOMING,
      category: NotificationCategory.WORKSPACE_ACTIVITY,
      severity:
        overdue || event.daysLeft <= 1 ? NotificationSeverity.WARN : NotificationSeverity.INFO,
      messageKey,
      messageParams: {
        returnName: event.returnName,
        periodStart: event.periodStart,
        periodEnd: event.periodEnd,
        taxYear: event.periodStart.slice(0, 4),
        dueDate: event.dueDate,
      },
      entityType: 'workspace',
      entityId: event.workspaceId,
      meta: { kind: event.kind, dueDate: event.dueDate, daysLeft: event.daysLeft },
    });
  }
}
