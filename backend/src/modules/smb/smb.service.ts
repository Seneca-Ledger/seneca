import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type Repository } from 'typeorm';
import { countedSql } from '../../common/utils/counted-transactions.util';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { Client } from '../../entities/client.entity';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { Payable, PayableDirection, PayableStatus } from '../../entities/payable.entity';
import { StatementStatus } from '../../entities/statement.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import type { User } from '../../entities/user.entity';
import { Workspace } from '../../entities/workspace.entity';
import { AuditService } from '../audit/audit.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { MailerService } from '../mailer/mailer.service';
import { PayablesService } from '../payables/payables.service';
import {
  type AgeingRow,
  ageing,
  type BankRow,
  type DuplicateGroup,
  findDuplicateOpenItems,
  matchOpenItems,
  type OpenItem,
  type ReconciliationMatch,
} from './reconciliation.util';

const OPEN_STATUSES = [PayableStatus.TO_PAY, PayableStatus.SCHEDULED, PayableStatus.OVERDUE];
const LOOKBACK_DAYS = 120;

export interface ReconciliationResponse {
  currency: string;
  matches: Array<ReconciliationMatch & { item: OpenItem; transaction: BankRow }>;
  unmatchedItems: OpenItem[];
  unmatchedRowCount: number;
  duplicates: DuplicateGroup[];
  ageing: AgeingRow[];
}

const REMINDER_TEXT: Record<string, { subject: string; body: string }> = {
  en: {
    subject: 'Reminder: invoice {{number}} of {{total}} is {{state}}',
    body: 'Hello {{client}},\n\nThis is a friendly reminder that invoice {{number}} for {{total}} was due on {{due}} and is {{state}}.\n\nIf you have already paid, please disregard this message.\n\nThank you,\n{{sender}}',
  },
  ru: {
    subject: 'Напоминание: счёт {{number}} на {{total}} {{state}}',
    body: 'Здравствуйте, {{client}}!\n\nНапоминаем, что счёт {{number}} на {{total}} со сроком оплаты {{due}} {{state}}.\n\nЕсли вы уже оплатили его, просто проигнорируйте это письмо.\n\nСпасибо,\n{{sender}}',
  },
};

/**
 * The small-business pack: statement rows against open bills and receivables,
 * ageing, duplicate bills and dunning reminders. Confirming a match goes through
 * PayablesService.markAsPaid, so the link, the receivable's invoice status and
 * the notification all follow the one existing path.
 */
@Injectable()
export class SmbService {
  private readonly logger = new Logger(SmbService.name);

  constructor(
    @InjectRepository(Payable)
    private readonly payableRepository: Repository<Payable>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly payablesService: PayablesService,
    private readonly mailerService: MailerService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly auditService: AuditService,
  ) {}

  async getReconciliation(workspaceId: string): Promise<ReconciliationResponse> {
    const currency = await this.workspaceCurrency(workspaceId);
    const items = await this.openItems(workspaceId, currency);
    const rows = await this.bankRows(workspaceId);
    const matches = matchOpenItems(items, rows);
    const matchedItems = new Set(matches.map(match => match.itemId));
    const matchedRows = new Set(matches.map(match => match.transactionId));
    const itemsById = new Map(items.map(item => [item.id, item]));
    const rowsById = new Map(rows.map(row => [row.id, row]));
    return {
      currency,
      matches: matches.map(match => ({
        ...match,
        item: itemsById.get(match.itemId) as OpenItem,
        transaction: rowsById.get(match.transactionId) as BankRow,
      })),
      unmatchedItems: items.filter(item => !matchedItems.has(item.id)),
      unmatchedRowCount: rows.filter(row => !matchedRows.has(row.id)).length,
      duplicates: findDuplicateOpenItems(items),
      ageing: ageing(items, today()),
    };
  }

  /** Links the row and marks the bill paid through the one existing path. */
  async confirm(
    workspaceId: string,
    userId: string,
    payableId: string,
    transactionId: string,
  ): Promise<Payable> {
    return this.payablesService.markAsPaid(payableId, workspaceId, userId, {
      linkedTransactionId: transactionId,
    });
  }

  async getAgeing(workspaceId: string): Promise<{ currency: string; ageing: AgeingRow[] }> {
    const currency = await this.workspaceCurrency(workspaceId);
    const items = await this.openItems(workspaceId, currency);
    return { currency, ageing: ageing(items, today()) };
  }

  async getDuplicates(workspaceId: string): Promise<DuplicateGroup[]> {
    const currency = await this.workspaceCurrency(workspaceId);
    return findDuplicateOpenItems(await this.openItems(workspaceId, currency));
  }

  /**
   * Emails the client a reminder for a sent or overdue invoice and counts it
   * on the invoice. Needs SMTP and a client email; the invoice itself is not
   * changed otherwise.
   */
  async sendInvoiceReminder(
    workspaceId: string,
    user: User,
    invoiceId: string,
  ): Promise<{ sent: boolean; to: string; reminderCount: number }> {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId, workspaceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== InvoiceStatus.SENT && invoice.status !== InvoiceStatus.OVERDUE) {
      throw new BadRequestException('Only a sent or overdue invoice can be reminded about');
    }
    const client = await this.clientRepository.findOne({
      where: { id: invoice.clientId, workspaceId },
    });
    if (!client?.email) throw new BadRequestException('The client has no email address');
    if (!(await this.mailerService.isConfigured(user))) {
      throw new ConflictException('SMTP is not configured for this workspace');
    }

    const locale = (user.locale ?? 'en').slice(0, 2);
    const text = REMINDER_TEXT[locale] ?? REMINDER_TEXT.en;
    const overdue = invoice.dueDate < today();
    const state =
      locale === 'ru'
        ? overdue
          ? 'просрочен'
          : 'ожидает оплаты'
        : overdue
          ? 'overdue'
          : 'awaiting payment';
    const fill = (template: string) =>
      template
        .replaceAll('{{number}}', invoice.invoiceNumber ?? invoice.id.slice(0, 8))
        .replaceAll('{{total}}', `${Number(invoice.total).toFixed(2)} ${invoice.currency}`)
        .replaceAll('{{due}}', String(invoice.dueDate).slice(0, 10))
        .replaceAll('{{state}}', state)
        .replaceAll('{{client}}', client.name)
        .replaceAll('{{sender}}', user.name || user.email);
    const sent = await this.mailerService.send({
      to: client.email,
      subject: fill(text.subject),
      text: fill(text.body),
      user,
    });
    if (sent) {
      invoice.reminderCount = (invoice.reminderCount ?? 0) + 1;
      invoice.lastReminderAt = new Date();
      await this.invoiceRepository.update(
        { id: invoice.id },
        { reminderCount: invoice.reminderCount, lastReminderAt: invoice.lastReminderAt },
      );
      await this.auditService
        .createEvent({
          workspaceId,
          actorType: ActorType.USER,
          actorId: user.id,
          entityType: EntityType.INVOICE,
          entityId: invoice.id,
          action: AuditAction.UPDATE,
          meta: {
            kind: 'invoice_reminder',
            to: client.email,
            reminderCount: invoice.reminderCount,
          },
          isUndoable: false,
        })
        .catch(error => this.logger.warn(`Reminder audit failed: ${String(error)}`));
    }
    return { sent, to: client.email, reminderCount: invoice.reminderCount ?? 0 };
  }

  private async openItems(workspaceId: string, currency: string): Promise<OpenItem[]> {
    const payables = await this.payableRepository.find({
      where: { workspaceId, status: In(OPEN_STATUSES), deletedAt: IsNull() },
      order: { dueDate: 'ASC' },
    });
    const items: OpenItem[] = [];
    for (const payable of payables) {
      const amount = Number(payable.amount);
      items.push({
        id: payable.id,
        direction: payable.direction === PayableDirection.RECEIVABLE ? 'receivable' : 'payable',
        vendor: payable.vendor,
        amount,
        currency: payable.currency,
        dueDate: payable.dueDate ? String(payable.dueDate).slice(0, 10) : null,
        createdAt: payable.createdAt.toISOString(),
        status: payable.status,
        amountInWorkspace: await this.convert(amount, payable.currency, currency, workspaceId),
      });
    }
    return items;
  }

  /** Recent statement rows not yet linked to any bill. */
  private async bankRows(workspaceId: string): Promise<BankRow[]> {
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    const rows = await this.transactionRepository
      .createQueryBuilder('t')
      .leftJoin('t.statement', 's')
      .select([
        't.id AS id',
        't.transactionType AS "type"',
        't.currency AS currency',
        't.debit AS debit',
        't.credit AS credit',
        't.transactionDate AS "date"',
        't.counterpartyName AS "counterpartyName"',
        't.paymentPurpose AS "paymentPurpose"',
      ])
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('(t.statementId IS NULL OR s.deletedAt IS NULL)')
      .andWhere('(s.status IS NULL OR s.status NOT IN (:...excluded))', {
        excluded: [StatementStatus.ERROR, StatementStatus.PROCESSING],
      })
      .andWhere('t.isDuplicate = false')
      .andWhere('t.transferPairId IS NULL')
      .andWhere(countedSql('t'))
      .andWhere('t.transactionDate >= :since', { since })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM payables p WHERE p.linked_transaction_id = t.id AND p.deleted_at IS NULL)',
      )
      .getRawMany<{
        id: string;
        type: TransactionType;
        currency: string;
        debit: string | null;
        credit: string | null;
        date: string | Date;
        counterpartyName: string | null;
        paymentPurpose: string | null;
      }>();
    return rows.map(row => ({
      id: row.id,
      type: row.type === TransactionType.INCOME ? 'income' : 'expense',
      amount:
        row.type === TransactionType.INCOME
          ? Number.parseFloat(row.credit ?? '0')
          : Number.parseFloat(row.debit ?? '0'),
      currency: row.currency,
      date:
        row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date).slice(0, 10),
      counterpartyName: row.counterpartyName,
      paymentPurpose: row.paymentPurpose,
    }));
  }

  private async workspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['currency'],
    });
    const normalized = String(workspace?.currency || '')
      .trim()
      .toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : 'KZT';
  }

  private async convert(
    amount: number,
    from: string,
    to: string,
    workspaceId: string,
  ): Promise<number> {
    if (!Number.isFinite(amount) || amount === 0) return 0;
    const source = (from || to).toUpperCase();
    if (source === to) return amount;
    const rate = await this.exchangeRatesService.getRateOrNull(source, to, undefined, workspaceId);
    return rate === null ? 0 : amount * rate;
  }
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
