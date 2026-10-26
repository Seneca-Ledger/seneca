import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { ImportCommittedEvent } from '../notifications/events/notification-events';
import { UnbookedPaymentsService } from './unbooked-payments.service';

/**
 * A statement just brought rows in: a bill or receivable marked paid without
 * a wallet or a bank row may have its money among them, and is linked to it.
 */
@Injectable()
export class PayablesEventsListener {
  private readonly logger = new Logger(PayablesEventsListener.name);

  constructor(private readonly unbookedPayments: UnbookedPaymentsService) {}

  @OnEvent('import.committed')
  async handleImportCommitted(event: ImportCommittedEvent): Promise<void> {
    try {
      const linked = await this.unbookedPayments.linkUnbooked(event.workspaceId);
      if (linked > 0) {
        this.logger.log(`Linked ${linked} payment(s) to imported rows in ${event.workspaceId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to link payments to imported rows in ${event.workspaceId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
