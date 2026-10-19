import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Client } from '../../entities/client.entity';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { InvoiceDelivery } from '../../entities/invoice-delivery.entity';
import { InvoiceSettings } from '../../entities/invoice-settings.entity';
import { Payable, PayableStatus } from '../../entities/payable.entity';
import type { User } from '../../entities/user.entity';
import { InvoiceDeliveryService } from './invoice-delivery.service';
import { InvoiceSettingsService, normalizeOffsets } from './invoice-settings.service';

/**
 * Reminding a client about an unpaid invoice.
 *
 * Nothing is sent until a workspace turns it on, and a client can be left out
 * of it: the complaint behind this feature is not only "I spend hours chasing"
 * but also "my tool mailed my clients without asking me". One row per invoice
 * and offset in the delivery log — the unique index, not a flag, is what makes
 * a second run of the scheduler a no-op.
 */
@Injectable()
export class InvoiceRemindersService {
  private readonly logger = new Logger(InvoiceRemindersService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceDelivery)
    private readonly deliveryRepository: Repository<InvoiceDelivery>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Payable)
    private readonly payableRepository: Repository<Payable>,
    private readonly deliveryService: InvoiceDeliveryService,
    private readonly settingsService: InvoiceSettingsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDueReminders(): Promise<void> {
    const enabled = await this.settingsService.withRemindersEnabled();
    for (const settings of enabled) {
      try {
        await this.runForWorkspace(settings);
      } catch (error) {
        this.logger.error(
          `Reminders for workspace ${settings.workspaceId} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /** Exposed for the scheduler and for tests that need a fixed "today". */
  async runForWorkspace(
    settings: InvoiceSettings,
    today: Date = new Date(),
  ): Promise<InvoiceDelivery[]> {
    const offsets = normalizeOffsets(settings.reminderOffsets);
    if (offsets.length === 0) {
      return [];
    }

    const open = await this.openInvoices(settings.workspaceId);
    const sent: InvoiceDelivery[] = [];

    for (const invoice of open) {
      const offset = this.offsetFor(invoice, offsets, today);
      if (offset === null) {
        continue;
      }
      // The unique index on (invoice, offset) is the real guard; this check
      // only saves the work of composing and sending.
      const already = await this.deliveryRepository.exists({
        where: { invoiceId: invoice.id, reminderOffset: offset },
      });
      if (already) {
        continue;
      }
      try {
        sent.push(
          await this.deliveryService.sendEmail(
            invoice.id,
            settings.workspaceId,
            // The reminder is the workspace's, not a person's: the log keeps
            // `sent_by` empty rather than crediting whoever issued the invoice.
            { id: null } as unknown as User,
            {},
            offset,
          ),
        );
      } catch (error) {
        this.logger.warn(
          `Reminder for invoice ${invoice.id} at offset ${offset} not sent: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return sent;
  }

  /** Which reminder is due today, if any. */
  private offsetFor(invoice: Invoice, offsets: number[], today: Date): number | null {
    const due = Date.parse(`${invoice.dueDate}T00:00:00.000Z`);
    const now = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const days = Math.round((now - due) / 86_400_000);
    return offsets.includes(days) ? days : null;
  }

  /** Issued, not void, not settled, and belonging to a client who wants chasing. */
  private async openInvoices(workspaceId: string): Promise<Invoice[]> {
    const invoices = await this.invoiceRepository.find({
      where: { workspaceId, status: InvoiceStatus.SENT },
    });
    if (invoices.length === 0) {
      return [];
    }

    const clientIds = [...new Set(invoices.map(invoice => invoice.clientId))];
    const quiet = new Set(
      (
        await this.clientRepository.find({
          where: { id: In(clientIds), remindersEnabled: false },
          select: ['id'],
        })
      ).map(client => client.id),
    );

    const payableIds = invoices
      .map(invoice => invoice.payableId)
      .filter((id): id is string => Boolean(id));
    const settled = new Set(
      payableIds.length === 0
        ? []
        : (
            await this.payableRepository.find({
              where: {
                id: In(payableIds),
                status: In([PayableStatus.PAID, PayableStatus.ARCHIVED]),
              },
              select: ['id'],
            })
          ).map(payable => payable.id),
    );

    return invoices.filter(
      invoice =>
        !(quiet.has(invoice.clientId) || (invoice.payableId && settled.has(invoice.payableId))) &&
        Boolean(invoice.invoiceNumber),
    );
  }
}
