import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '../../entities/notification.entity';
import { Workspace, WorkspaceKind } from '../../entities/workspace.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ReviewInboxService } from './review-inbox.service';

/**
 * Once a week, one line per workspace with something waiting. The row goes
 * through the normal notification pipeline, so the member's digest mode,
 * quiet hours and the "uncategorised items" preference decide if and when it
 * is actually delivered.
 */
@Injectable()
export class ReviewInboxScheduler {
  private readonly logger = new Logger(ReviewInboxScheduler.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly reviewInboxService: ReviewInboxService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('30 8 * * 1')
  async notifyWaiting(): Promise<void> {
    // Nothing in a past version waits for anyone: it cannot be changed.
    const workspaces = await this.workspaceRepository.find({
      where: { kind: WorkspaceKind.STANDARD },
      select: {
        id: true,
      },
    });
    for (const workspace of workspaces) {
      try {
        const counts = await this.reviewInboxService.counts(workspace.id);
        if (counts.total === 0) {
          continue;
        }
        await this.notificationsService.createForWorkspaceMembers({
          workspaceId: workspace.id,
          type: NotificationType.TRANSACTION_UNCATEGORIZED,
          category: NotificationCategory.WORKSPACE_ACTIVITY,
          severity: NotificationSeverity.INFO,
          messageKey: 'review.waiting',
          messageParams: { count: counts.total },
          entityType: 'review-inbox',
          entityId: workspace.id,
          meta: { counts },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Review inbox digest failed for workspace ${workspace.id}: ${message}`);
      }
    }
  }
}
