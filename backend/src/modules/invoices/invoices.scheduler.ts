import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, type Repository } from 'typeorm';
import { Invoice } from '../../entities/invoice.entity';
import { InvoiceLineItem } from '../../entities/invoice-line-item.entity';
import { advanceIssueDate } from './invoice-recurrence.util';
import { InvoicesService } from './invoices.service';

@Injectable()
export class InvoicesScheduler {
  private readonly logger = new Logger(InvoicesScheduler.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceLineItem)
    private readonly lineItemRepository: Repository<InvoiceLineItem>,
    private readonly invoicesService: InvoicesService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async generateRecurringInvoices(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const templates = await this.invoiceRepository.find({
      where: { isRecurring: true, nextIssueDate: LessThanOrEqual(today), deletedAt: IsNull() },
    });

    for (const template of templates) {
      if (template.recurrenceEndDate && template.recurrenceEndDate < today) {
        continue;
      }
      try {
        await this.generateOne(template);
      } catch (error) {
        this.logger.warn(
          `Failed to generate recurring invoice from ${template.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private async generateOne(template: Invoice): Promise<void> {
    const lineItems = await this.lineItemRepository.find({
      where: { invoiceId: template.id },
      order: { sortOrder: 'ASC' },
    });
    if (lineItems.length === 0 || !template.recurrenceInterval) {
      return;
    }
    await this.invoicesService.cloneAsDraft(template, lineItems);

    // Anchored on the template's own issue date: advancing from a clamped
    // month-end (28 February) would otherwise move the whole series onto the 28th.
    const next = advanceIssueDate(
      template.nextIssueDate as string,
      template.recurrenceInterval,
      template.issueDate,
    );
    await this.invoiceRepository.update({ id: template.id }, { nextIssueDate: next });
  }
}
