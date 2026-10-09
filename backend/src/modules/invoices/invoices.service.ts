import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { fromMinor } from '../../common/utils/money.util';
import { normalizePagination } from '../../common/utils/pagination.util';
import { Client } from '../../entities/client.entity';
import { CreditNoteStatus } from '../../entities/credit-note.entity';
import { Invoice, InvoiceRecurrenceInterval, InvoiceStatus } from '../../entities/invoice.entity';
import { InvoiceLineItem } from '../../entities/invoice-line-item.entity';
import { JournalEntry, JournalEntryStatus } from '../../entities/journal-entry.entity';
import { JournalLine } from '../../entities/journal-line.entity';
import {
  Payable,
  PayableDirection,
  PayableSource,
  PayableStatus,
} from '../../entities/payable.entity';
import type { WorkspaceBusinessProfile } from '../../entities/workspace-business-profile.entity';
import { BusinessProfileService } from '../business-profile/business-profile.service';
import { LedgerPostingError, LedgerPostingService } from '../ledger/ledger-posting.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';
import type { InvoiceLineItemDto } from './dto/invoice-line-item.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { buildInvoicePdf } from './invoice-document';
import { documentLines, priceLines, totalsOf } from './invoice-pricing';
import { advanceIssueDate, shiftDueDate } from './invoice-recurrence.util';
import { InvoiceSettingsService } from './invoice-settings.service';

/**
 * The status a user sees, in SQL.
 *
 * A draft or a void'd invoice is what the column says; anything else takes
 * 'paid' and 'overdue' from the receivable the send opened, which is where
 * those two transitions actually happen. Computed in the query rather than per
 * row so a list, its filter and its count can never disagree.
 */
const EFFECTIVE_STATUS_SQL = `CASE
  WHEN invoice.status IN ('${InvoiceStatus.DRAFT}', '${InvoiceStatus.VOID}') THEN invoice.status::text
  WHEN payable.status = '${PayableStatus.PAID}' THEN '${InvoiceStatus.PAID}'
  WHEN payable.status = '${PayableStatus.PARTIALLY_PAID}' THEN '${InvoiceStatus.PARTIALLY_PAID}'
  WHEN payable.status = '${PayableStatus.OVERDUE}' THEN '${InvoiceStatus.OVERDUE}'
  ELSE invoice.status::text
END`;

/** What has arrived against the invoice, and what is still open. */
const AMOUNT_PAID_SQL = 'COALESCE(payable.paid_amount, 0)';

/** What credit notes have taken back off the invoice. */
const AMOUNT_CREDITED_SQL = `COALESCE((
  SELECT SUM(application."amount")
    FROM "credit_note_applications" application
    JOIN "credit_notes" note ON note."id" = application."credit_note_id"
   WHERE application."invoice_id" = invoice."id"
     AND note."status" = '${CreditNoteStatus.ISSUED}'
), 0)`;

function applyAmounts(invoice: Invoice, paid: unknown, credited: unknown): Invoice {
  const amountPaid = Math.round(Number(paid ?? 0) * 100) / 100;
  const amountCredited = Math.round(Number(credited ?? 0) * 100) / 100;
  invoice.amountPaid = amountPaid;
  invoice.amountCredited = amountCredited;
  // What the client still owes: the credited part is not owed and was never
  // paid, so both come off the total.
  invoice.amountDue = Math.round((Number(invoice.total) - amountPaid - amountCredited) * 100) / 100;
  return invoice;
}

function applyEffectiveStatus(invoice: Invoice, status: unknown): Invoice {
  if (typeof status === 'string' && status) {
    invoice.status = status as InvoiceStatus;
  }
  return invoice;
}

interface DraftInput {
  issueDate: string;
  dueDate: string;
  currency: string;
  notes: string | null;
  pricesIncludeTax: boolean;
  lineItems: InvoiceLineItemDto[];
  recurrenceInterval: InvoiceRecurrenceInterval | null;
  recurrenceEndDate: string | null;
  sourceRecurringInvoiceId: string | null;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly ledgerPostingService: LedgerPostingService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
    private readonly businessProfile: BusinessProfileService,
    private readonly settingsService: InvoiceSettingsService,
  ) {}

  async create(workspaceId: string, dto: CreateInvoiceDto): Promise<Invoice> {
    const client = await this.clientInWorkspace(workspaceId, dto.clientId);
    return this.buildDraft(workspaceId, dto.clientId, {
      issueDate: dto.issueDate,
      dueDate: dto.dueDate ?? (await this.dueDateFor(workspaceId, client, dto.issueDate)),
      // What the invoice says wins, then what this client is usually billed in,
      // and the workspace's own currency last.
      currency: await this.workspaceCurrency.resolveFor(
        workspaceId,
        dto.currency || client.currency,
      ),
      notes: dto.notes ?? null,
      pricesIncludeTax: dto.pricesIncludeTax ?? false,
      lineItems: dto.lineItems,
      recurrenceInterval: dto.recurrenceInterval ?? null,
      recurrenceEndDate: dto.recurrenceEndDate ?? null,
      sourceRecurringInvoiceId: null,
    });
  }

  /** Clones a recurring template's line items into a fresh, unsent copy. */
  async cloneAsDraft(template: Invoice, lineItems: InvoiceLineItem[]): Promise<Invoice> {
    const issueDate = template.nextIssueDate;
    if (!issueDate) {
      throw new BadRequestException('Recurring invoice has no next issue date');
    }
    return this.buildDraft(template.workspaceId, template.clientId, {
      issueDate,
      dueDate: shiftDueDate(template.issueDate, template.dueDate, issueDate),
      currency: template.currency,
      notes: template.notes,
      pricesIncludeTax: template.pricesIncludeTax,
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRateId: item.taxRateId ?? undefined,
        categoryId: item.categoryId ?? undefined,
      })),
      recurrenceInterval: null,
      recurrenceEndDate: null,
      sourceRecurringInvoiceId: template.id,
    });
  }

  async findAll(workspaceId: string, filters: FilterInvoicesDto) {
    const { page, limit, skip } = normalizePagination(filters);
    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .leftJoin(Payable, 'payable', 'payable.id = invoice.payable_id')
      .addSelect(`${EFFECTIVE_STATUS_SQL}`, 'effective_status')
      .addSelect(AMOUNT_PAID_SQL, 'amount_paid')
      .addSelect(AMOUNT_CREDITED_SQL, 'amount_credited')
      .where('invoice.workspaceId = :workspaceId', { workspaceId })
      .andWhere('invoice.deletedAt IS NULL');

    if (filters.status) {
      // Filtered on the same expression the rows are read with: 'paid' and
      // 'overdue' live on the receivable, never in `invoices.status`, so a
      // filter on the column alone matched nothing.
      queryBuilder.andWhere(`${EFFECTIVE_STATUS_SQL} = :status`, { status: filters.status });
    }
    if (filters.clientId) {
      queryBuilder.andWhere('invoice.clientId = :clientId', { clientId: filters.clientId });
    }
    if (filters.search) {
      queryBuilder.andWhere(
        '(LOWER(invoice.invoiceNumber) LIKE :search OR LOWER(client.name) LIKE :search)',
        { search: `%${filters.search.toLowerCase()}%` },
      );
    }

    const [{ entities, raw }, total] = await Promise.all([
      queryBuilder.orderBy('invoice.issueDate', 'DESC').skip(skip).take(limit).getRawAndEntities(),
      queryBuilder.getCount(),
    ]);

    return {
      data: entities.map((invoice, index) =>
        applyAmounts(
          applyEffectiveStatus(invoice, raw[index]?.effective_status),
          raw[index]?.amount_paid,
          raw[index]?.amount_credited,
        ),
      ),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async findOne(id: string, workspaceId: string): Promise<Invoice> {
    const result = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client')
      .leftJoinAndSelect('invoice.lineItems', 'lineItem')
      .leftJoin(Payable, 'payable', 'payable.id = invoice.payable_id')
      .addSelect(`${EFFECTIVE_STATUS_SQL}`, 'effective_status')
      .addSelect(AMOUNT_PAID_SQL, 'amount_paid')
      .addSelect(AMOUNT_CREDITED_SQL, 'amount_credited')
      .where('invoice.id = :id AND invoice.workspaceId = :workspaceId', { id, workspaceId })
      .orderBy('lineItem.sortOrder', 'ASC')
      .getRawAndEntities();

    const [invoice] = result.entities;
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return applyAmounts(
      applyEffectiveStatus(invoice, result.raw[0]?.effective_status),
      result.raw[0]?.amount_paid,
      result.raw[0]?.amount_credited,
    );
  }

  async getPdf(id: string, workspaceId: string): Promise<{ fileName: string; data: Buffer }> {
    // `fileData` is `select: false` on the entity; addSelect brings it back for this one read.
    const invoice = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .addSelect('invoice.fileData')
      .where('invoice.id = :id AND invoice.workspaceId = :workspaceId', { id, workspaceId })
      .getOne();
    if (!invoice?.fileData) {
      throw new NotFoundException('Invoice PDF not found');
    }
    return {
      fileName: `${invoice.invoiceNumber ?? 'invoice'}.pdf`,
      data: invoice.fileData,
    };
  }

  async update(id: string, workspaceId: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    return this.invoiceRepository.manager.transaction(async manager => {
      const invoices = manager.getRepository(Invoice);
      const invoice = await invoices.findOne({ where: { id, workspaceId } });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new ConflictException(appError('INVOICE_NOT_DRAFT'));
      }

      if (dto.clientId) {
        await this.clientInWorkspace(workspaceId, dto.clientId);
      }
      this.applyDraftFields(invoice, dto);
      await invoices.save(invoice);

      if (dto.lineItems) {
        await this.replaceLineItems(manager, invoice.id, dto.lineItems);
      }
      return this.recalculateTotals(manager, invoice.id);
    });
  }

  /**
   * Assigns the invoice number, books the accrual entry (unless the ledger is
   * not enabled for this workspace), generates the PDF and opens the
   * receivable — all in one transaction, so none of it is left half-done.
   */
  async send(id: string, workspaceId: string, userId: string): Promise<Invoice> {
    return this.invoiceRepository.manager.transaction(async manager => {
      const invoices = manager.getRepository(Invoice);
      const invoice = await invoices.findOne({
        where: { id, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new ConflictException(appError('INVOICE_ALREADY_SENT'));
      }

      const { lineItems, client, profile } = await this.sendableOrThrow(manager, invoice);

      invoice.invoiceNumber = await this.nextInvoiceNumber(manager, workspaceId);
      // The link's secret. 24 random bytes, so the url cannot be guessed from
      // a number or a date the way a sequential id could.
      invoice.shareToken = randomBytes(24).toString('base64url');

      try {
        const entry = await this.ledgerPostingService.postInvoice(manager, {
          workspaceId,
          entryDate: invoice.issueDate,
          currency: invoice.currency,
          lines: await this.postingLinesOf(manager, invoice, lineItems),
          memo: `Invoice ${invoice.invoiceNumber}`,
          userId,
        });
        invoice.journalEntryId = entry.id;
      } catch (error) {
        // Invoicing works whether or not the workspace has opted into the
        // experimental double-entry ledger; a missing rate or other posting
        // failure, by contrast, is a real problem and must stop the send.
        if (!(error instanceof LedgerPostingError && error.code === 'LEDGER_DISABLED')) {
          throw error;
        }
      }

      // Same fields PayablesService.create would set; inlined so the receivable
      // opens in this same transaction instead of a separate one.
      const payable = await manager.getRepository(Payable).save(
        manager.getRepository(Payable).create({
          workspaceId,
          createdById: userId,
          direction: PayableDirection.RECEIVABLE,
          vendor: client.name,
          amount: invoice.total,
          currency: invoice.currency,
          dueDate: this.parseDateOnly(invoice.dueDate),
          status: PayableStatus.TO_PAY,
          source: PayableSource.INVOICE,
          isRecurring: false,
          comment: invoice.invoiceNumber,
        }),
      );
      invoice.payableId = payable.id;

      const pdf = await buildInvoicePdf({
        invoice,
        client,
        profile,
        lines: await documentLines(manager, lineItems, invoice.pricesIncludeTax),
        logo: await this.businessProfile.logoDataUri(profile),
      });
      const fileSize = pdf.length;
      const fileHash = createHash('sha256').update(pdf).digest('hex');
      // Written via `update`, not the entity object: `fileData` must never ride
      // along on the returned `Invoice` and get serialised into the response.
      await invoices.update({ id: invoice.id }, { fileData: pdf, fileSize, fileHash });
      invoice.fileSize = fileSize;
      invoice.fileHash = fileHash;

      invoice.status = InvoiceStatus.SENT;
      return invoices.save(invoice);
    });
  }

  /**
   * Everything the send needs, or the reason it cannot happen.
   *
   * All of it is checked before the invoice number is taken: the sequence is
   * gap-free, so a number must never be spent on a document that then fails to
   * render or has nobody to be sent to.
   */
  private async sendableOrThrow(
    manager: EntityManager,
    invoice: Invoice,
  ): Promise<{
    lineItems: InvoiceLineItem[];
    client: Client;
    profile: WorkspaceBusinessProfile;
  }> {
    const lineItems = await manager.getRepository(InvoiceLineItem).find({
      where: { invoiceId: invoice.id },
      order: { sortOrder: 'ASC' },
    });
    if (lineItems.length === 0 || Number(invoice.total) <= 0) {
      throw new BadRequestException(appError('INVOICE_ZERO_TOTAL'));
    }

    const profile = await this.businessProfile.get(invoice.workspaceId);
    const missing = this.businessProfile.missingRequiredFields(profile);
    if (missing.length > 0) {
      throw new BadRequestException(
        appError('INVOICE_PROFILE_INCOMPLETE', { fields: missing.join(', ') }),
      );
    }

    const client = await manager.getRepository(Client).findOne({
      where: { id: invoice.clientId, workspaceId: invoice.workspaceId },
    });
    if (!client) {
      throw new BadRequestException(appError('INVOICE_CLIENT_NOT_FOUND'));
    }

    return { lineItems, client, profile };
  }

  async void(id: string, workspaceId: string, userId: string): Promise<Invoice> {
    return this.invoiceRepository.manager.transaction(async manager => {
      const invoices = manager.getRepository(Invoice);
      const invoice = await invoices.findOne({
        where: { id, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      // `invoices.status` never says 'paid' — the receivable does — so the
      // stored column alone would let a settled invoice be voided, reversing
      // revenue for money that is already in the bank.
      if (await this.isSettled(manager, invoice)) {
        throw new ConflictException(appError('INVOICE_NOT_VOIDABLE'));
      }

      if (invoice.journalEntryId) {
        // Locked without its `lines` relation: Postgres refuses FOR UPDATE on
        // the nullable side of the outer join a relations-based fetch would
        // use. The lines are loaded separately, same as `reverseEntry` does.
        const entry = await manager.getRepository(JournalEntry).findOne({
          where: { id: invoice.journalEntryId, workspaceId },
          lock: { mode: 'pessimistic_write' },
        });
        if (entry && entry.status === JournalEntryStatus.POSTED && !entry.reversalOfId) {
          entry.lines = await manager.getRepository(JournalLine).find({
            where: { entryId: entry.id },
            order: { lineNo: 'ASC' },
          });
          await this.ledgerPostingService.reverseWithin(manager, entry, { userId });
        }
      }
      if (invoice.payableId) {
        await manager
          .getRepository(Payable)
          .update({ id: invoice.payableId }, { status: PayableStatus.ARCHIVED });
      }

      invoice.status = InvoiceStatus.VOID;
      return invoices.save(invoice);
    });
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const invoice = await this.invoiceRepository.findOne({ where: { id, workspaceId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException(appError('INVOICE_NOT_DRAFT'));
    }
    await this.invoiceRepository.softRemove(invoice);
  }

  async getNumberingSettings(workspaceId: string): Promise<{ prefix: string }> {
    await this.invoiceRepository.manager.query(
      `INSERT INTO "invoice_counters" ("workspace_id") VALUES ($1) ON CONFLICT DO NOTHING`,
      [workspaceId],
    );
    const rows: Array<{ prefix: string }> = await this.invoiceRepository.manager.query(
      `SELECT "prefix" FROM "invoice_counters" WHERE "workspace_id" = $1`,
      [workspaceId],
    );
    return { prefix: rows[0]?.prefix ?? 'INV-' };
  }

  async updateNumberPrefix(workspaceId: string, prefix: string): Promise<{ prefix: string }> {
    const trimmed = prefix.trim().slice(0, 20);
    await this.invoiceRepository.manager.query(
      `INSERT INTO "invoice_counters" ("workspace_id", "prefix") VALUES ($1, $2)
         ON CONFLICT ("workspace_id") DO UPDATE SET "prefix" = $2`,
      [workspaceId, trimmed],
    );
    return { prefix: trimmed };
  }

  private async buildDraft(
    workspaceId: string,
    clientId: string,
    input: DraftInput,
  ): Promise<Invoice> {
    return this.invoiceRepository.manager.transaction(async manager => {
      const invoices = manager.getRepository(Invoice);
      const invoice = await invoices.save(
        invoices.create({
          workspaceId,
          clientId,
          status: InvoiceStatus.DRAFT,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          currency: input.currency,
          notes: input.notes,
          pricesIncludeTax: input.pricesIncludeTax,
          isRecurring: !!input.recurrenceInterval,
          recurrenceInterval: input.recurrenceInterval,
          nextIssueDate: input.recurrenceInterval
            ? advanceIssueDate(input.issueDate, input.recurrenceInterval)
            : null,
          recurrenceEndDate: input.recurrenceEndDate,
          sourceRecurringInvoiceId: input.sourceRecurringInvoiceId,
        }),
      );
      await this.replaceLineItems(manager, invoice.id, input.lineItems);
      return this.recalculateTotals(manager, invoice.id);
    });
  }

  private async replaceLineItems(
    manager: EntityManager,
    invoiceId: string,
    items: InvoiceLineItemDto[],
  ): Promise<void> {
    const repo = manager.getRepository(InvoiceLineItem);
    await repo.delete({ invoiceId });
    if (items.length === 0) {
      return;
    }
    await repo.insert(
      items.map((item, index) => ({
        invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRateId: item.taxRateId ?? null,
        categoryId: item.categoryId ?? null,
        sortOrder: index,
      })),
    );
  }

  private async recalculateTotals(manager: EntityManager, invoiceId: string): Promise<Invoice> {
    const lineItems = await manager.getRepository(InvoiceLineItem).find({
      where: { invoiceId },
      order: { sortOrder: 'ASC' },
    });
    const invoice = await manager.getRepository(Invoice).findOneOrFail({
      where: { id: invoiceId },
    });

    const totals = totalsOf(await priceLines(manager, lineItems, invoice.pricesIncludeTax));

    invoice.subtotal = totals.subtotal;
    invoice.taxTotal = totals.taxTotal;
    invoice.total = totals.total;
    const saved = await manager.getRepository(Invoice).save(invoice);
    saved.lineItems = lineItems;
    return saved;
  }

  /** Net amount and tax, per line item, for the ledger's accrual legs. */
  private async postingLinesOf(
    manager: EntityManager,
    invoice: Invoice,
    lineItems: InvoiceLineItem[],
  ): Promise<Array<{ amount: number; taxAmount: number; categoryId: string | null }>> {
    const priced = await priceLines(manager, lineItems, invoice.pricesIncludeTax);
    return priced.map(line => ({
      amount: fromMinor(line.netMinor),
      taxAmount: fromMinor(line.taxMinor),
      categoryId: line.categoryId,
    }));
  }

  /**
   * The draft as the client would receive it, rendered on the fly.
   *
   * Nothing is stored and no number is taken: sending is irreversible, and
   * seeing the document first is how a wrong address or a missing bank line
   * gets caught before the client does.
   */
  async previewPdf(id: string, workspaceId: string): Promise<{ fileName: string; data: Buffer }> {
    const invoice = await this.findOne(id, workspaceId);
    const profile = await this.businessProfile.get(workspaceId);
    const manager = this.invoiceRepository.manager;
    const lineItems = invoice.lineItems ?? [];
    const data = await buildInvoicePdf({
      invoice,
      client: invoice.client,
      profile,
      lines: await documentLines(manager, lineItems, invoice.pricesIncludeTax),
      logo: await this.businessProfile.logoDataUri(profile),
      draft: invoice.status === InvoiceStatus.DRAFT,
    });
    return { fileName: `${invoice.invoiceNumber ?? 'draft'}.pdf`, data };
  }

  private async nextInvoiceNumber(manager: EntityManager, workspaceId: string): Promise<string> {
    await manager.query(
      `INSERT INTO "invoice_counters" ("workspace_id") VALUES ($1) ON CONFLICT DO NOTHING`,
      [workspaceId],
    );
    const rows: Array<{ prefix: string; invoice_no: string }> = await manager.query(
      `WITH taken AS (
         UPDATE "invoice_counters" SET "next_invoice_no" = "next_invoice_no" + 1
          WHERE "workspace_id" = $1
          RETURNING "prefix", "next_invoice_no" - 1 AS "invoice_no"
       )
       SELECT "prefix", "invoice_no" FROM taken`,
      [workspaceId],
    );
    return `${rows[0].prefix}${rows[0].invoice_no}`;
  }

  /** Whether the invoice's receivable has been settled. */
  private async isSettled(manager: EntityManager, invoice: Invoice): Promise<boolean> {
    if (!invoice.payableId) {
      return false;
    }
    const payable = await manager.getRepository(Payable).findOne({
      where: { id: invoice.payableId },
      select: ['status'],
    });
    return payable?.status === PayableStatus.PAID;
  }

  private applyDraftFields(invoice: Invoice, dto: UpdateInvoiceDto): void {
    if (dto.clientId) {
      invoice.clientId = dto.clientId;
    }
    if (dto.issueDate !== undefined) {
      invoice.issueDate = dto.issueDate;
    }
    if (dto.dueDate !== undefined) {
      invoice.dueDate = dto.dueDate;
    }
    if (dto.currency !== undefined) {
      invoice.currency = dto.currency;
    }
    if (dto.notes !== undefined) {
      invoice.notes = dto.notes ?? null;
    }
    if (dto.pricesIncludeTax !== undefined) {
      invoice.pricesIncludeTax = dto.pricesIncludeTax;
    }
    if (dto.recurrenceInterval !== undefined) {
      invoice.isRecurring = !!dto.recurrenceInterval;
      invoice.recurrenceInterval = dto.recurrenceInterval ?? null;
      invoice.nextIssueDate = dto.recurrenceInterval
        ? advanceIssueDate(invoice.issueDate, dto.recurrenceInterval)
        : null;
    }
    if (dto.recurrenceEndDate !== undefined) {
      invoice.recurrenceEndDate = dto.recurrenceEndDate ?? null;
    }
  }

  /**
   * When the invoice does not name a due date: the client's own term, then the
   * workspace's. "Net 30" is a property of the relationship, not something to
   * retype on every invoice.
   */
  private async dueDateFor(
    workspaceId: string,
    client: Client,
    issueDate: string,
  ): Promise<string> {
    const days =
      client.paymentTermsDays ?? (await this.settingsService.get(workspaceId)).paymentTermsDays;
    const due = new Date(`${issueDate}T00:00:00.000Z`);
    due.setUTCDate(due.getUTCDate() + days);
    return due.toISOString().slice(0, 10);
  }

  private async clientInWorkspace(workspaceId: string, clientId: string): Promise<Client> {
    const client = await this.clientRepository.findOne({ where: { id: clientId, workspaceId } });
    if (!client) {
      throw new BadRequestException(appError('INVOICE_CLIENT_NOT_FOUND'));
    }
    return client;
  }

  private parseDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }
}
