import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, In, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { fromMinor } from '../../common/utils/money.util';
import { normalizePagination } from '../../common/utils/pagination.util';
import { Client } from '../../entities/client.entity';
import { CreditNote, CreditNoteStatus } from '../../entities/credit-note.entity';
import { CreditNoteApplication } from '../../entities/credit-note-application.entity';
import { CreditNoteLineItem } from '../../entities/credit-note-line-item.entity';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { InvoiceLineItem } from '../../entities/invoice-line-item.entity';
import { JournalEntry, JournalEntryStatus } from '../../entities/journal-entry.entity';
import { JournalLine } from '../../entities/journal-line.entity';
import { Payable } from '../../entities/payable.entity';
import { BusinessProfileService } from '../business-profile/business-profile.service';
import { LedgerPostingError, LedgerPostingService } from '../ledger/ledger-posting.service';
import { PayablesService } from '../payables/payables.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';
import { buildCreditNotePdf } from './invoice-document';
import { documentLines, priceLines, totalsOf } from './invoice-pricing';

/** One invoice's share of a credit note, resolved against what it can carry. */
interface ResolvedApplication {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  /** How much of the invoice is credited, as a share of its total. */
  factor: number;
}

function round2(value: number): number {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * Credit notes: taking money back off invoices the client already has.
 *
 * A note is raised against invoices that exist, for amounts they can carry, so
 * there is no draft stage — one call numbers it, books the mirror of the
 * invoice's accrual, lowers each receivable and renders the document. Its lines
 * are copies of the credited invoices' lines, scaled when only part is
 * credited, so every tax rate comes back at the rate it went out at.
 */
@Injectable()
export class CreditNotesService {
  constructor(
    @InjectRepository(CreditNote)
    private readonly creditNoteRepository: Repository<CreditNote>,
    private readonly ledgerPostingService: LedgerPostingService,
    private readonly businessProfile: BusinessProfileService,
    private readonly payables: PayablesService,
  ) {}

  async findAll(workspaceId: string, filters: FilterInvoicesDto) {
    const { page, limit, skip } = normalizePagination(filters);
    const query = this.creditNoteRepository
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.client', 'client')
      .where('note.workspaceId = :workspaceId', { workspaceId })
      .orderBy('note.issueDate', 'DESC')
      .addOrderBy('note.createdAt', 'DESC')
      .skip(skip)
      .take(limit);
    if (filters.clientId) {
      query.andWhere('note.clientId = :clientId', { clientId: filters.clientId });
    }
    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async findOne(id: string, workspaceId: string): Promise<CreditNote> {
    const note = await this.creditNoteRepository.findOne({
      where: { id, workspaceId },
      relations: { client: true, lineItems: true, applications: true },
      order: { lineItems: { sortOrder: 'ASC' } },
    });
    if (!note) {
      throw new NotFoundException('Credit note not found');
    }
    return note;
  }

  /** The notes credited against one invoice, for its detail screen. */
  async findForInvoice(invoiceId: string, workspaceId: string): Promise<CreditNote[]> {
    const applications = await this.creditNoteRepository.manager
      .getRepository(CreditNoteApplication)
      .find({ where: { invoiceId, workspaceId } });
    if (applications.length === 0) {
      return [];
    }
    return this.creditNoteRepository.find({
      where: { id: In(applications.map(row => row.creditNoteId)), workspaceId },
      relations: { applications: true },
      order: { issueDate: 'DESC' },
    });
  }

  async create(workspaceId: string, userId: string, dto: CreateCreditNoteDto): Promise<CreditNote> {
    const issueDate = dto.issueDate ?? new Date().toISOString().slice(0, 10);

    return this.creditNoteRepository.manager.transaction(async manager => {
      const resolved = await this.resolveApplications(manager, workspaceId, dto);
      const [first] = resolved;
      const note = await manager.getRepository(CreditNote).save(
        manager.getRepository(CreditNote).create({
          workspaceId,
          clientId: first.invoice.clientId,
          creditNoteNumber: await this.nextCreditNoteNumber(manager, workspaceId),
          status: CreditNoteStatus.ISSUED,
          issueDate,
          currency: first.invoice.currency,
          pricesIncludeTax: first.invoice.pricesIncludeTax,
          reason: dto.reason ?? null,
          createdById: userId,
        }),
      );

      const groups = await this.copyLines(manager, note, resolved);
      const lineItems = groups.flatMap(group => group.lines);
      const priced = await priceLines(manager, lineItems, note.pricesIncludeTax);
      const totals = totalsOf(priced);
      if (totals.total <= 0) {
        throw new BadRequestException(appError('CREDIT_NOTE_ZERO_TOTAL'));
      }
      note.subtotal = totals.subtotal;
      note.taxTotal = totals.taxTotal;
      note.total = totals.total;

      // Each invoice is credited with what its own lines add up to, not with
      // what was asked for: the two differ by cents when part of an invoice is
      // credited and the scaled unit prices round.
      const applications = manager.getRepository(CreditNoteApplication);
      let offset = 0;
      for (const group of groups) {
        const amount = totalsOf(priced.slice(offset, offset + group.lines.length)).total;
        offset += group.lines.length;
        if (amount <= 0) {
          continue;
        }
        await applications.save(
          applications.create({
            creditNoteId: note.id,
            invoiceId: group.application.invoice.id,
            workspaceId,
            amount,
          }),
        );
        await this.reduceReceivable(manager, workspaceId, group.application.invoice, amount);
      }

      try {
        const entry = await this.ledgerPostingService.postCreditNote(manager, {
          workspaceId,
          entryDate: issueDate,
          currency: note.currency,
          lines: priced.map(line => ({
            amount: fromMinor(line.netMinor),
            taxAmount: fromMinor(line.taxMinor),
            categoryId: line.categoryId,
          })),
          memo: `Credit note ${note.creditNoteNumber}`,
          userId,
        });
        note.journalEntryId = entry.id;
      } catch (error) {
        // Same rule as the invoice send: a workspace that never opted into the
        // ledger still gets its credit note, anything else is a real failure.
        if (!(error instanceof LedgerPostingError && error.code === 'LEDGER_DISABLED')) {
          throw error;
        }
      }

      const saved = await manager.getRepository(CreditNote).save(note);

      // Written last and through `update`: the bytes must never ride along on
      // a saved entity and end up in a response.
      const pdf = await this.renderPdf(manager, saved, lineItems, resolved);
      const fileHash = createHash('sha256').update(pdf).digest('hex');
      await manager
        .getRepository(CreditNote)
        .update({ id: saved.id }, { fileData: pdf, fileSize: pdf.length, fileHash });
      saved.fileSize = pdf.length;
      saved.fileHash = fileHash;
      saved.lineItems = lineItems;
      return saved;
    });
  }

  /**
   * Undoes a credit note: reverses its entry, gives each invoice back what it
   * credited, and leaves the note itself in place marked void — a numbered
   * document that was sent out is never deleted.
   */
  async void(id: string, workspaceId: string, userId: string): Promise<CreditNote> {
    return this.creditNoteRepository.manager.transaction(async manager => {
      const notes = manager.getRepository(CreditNote);
      const note = await notes.findOne({
        where: { id, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!note) {
        throw new NotFoundException('Credit note not found');
      }
      if (note.status === CreditNoteStatus.VOID) {
        throw new ConflictException(appError('CREDIT_NOTE_ALREADY_VOID'));
      }

      const applications = await manager
        .getRepository(CreditNoteApplication)
        .find({ where: { creditNoteId: note.id, workspaceId } });
      for (const application of applications) {
        const invoice = await manager
          .getRepository(Invoice)
          .findOne({ where: { id: application.invoiceId, workspaceId } });
        if (invoice) {
          await this.reduceReceivable(manager, workspaceId, invoice, -Number(application.amount));
        }
      }

      if (note.journalEntryId) {
        const entry = await manager.getRepository(JournalEntry).findOne({
          where: { id: note.journalEntryId, workspaceId },
          lock: { mode: 'pessimistic_write' },
        });
        if (entry && entry.status === JournalEntryStatus.POSTED && !entry.reversalOfId) {
          entry.lines = await manager
            .getRepository(JournalLine)
            .find({ where: { entryId: entry.id }, order: { lineNo: 'ASC' } });
          await this.ledgerPostingService.reverseWithin(manager, entry, { userId });
        }
      }

      note.status = CreditNoteStatus.VOID;
      return notes.save(note);
    });
  }

  async getPdf(id: string, workspaceId: string): Promise<{ fileName: string; data: Buffer }> {
    const note = await this.creditNoteRepository
      .createQueryBuilder('note')
      .addSelect('note.fileData')
      .where('note.id = :id AND note.workspaceId = :workspaceId', { id, workspaceId })
      .getOne();
    if (!note?.fileData) {
      throw new NotFoundException('Credit note PDF not found');
    }
    return { fileName: `${note.creditNoteNumber ?? 'credit-note'}.pdf`, data: note.fileData };
  }

  /** What the invoices can carry, and how much of each is being credited. */
  private async resolveApplications(
    manager: EntityManager,
    workspaceId: string,
    dto: CreateCreditNoteDto,
  ): Promise<ResolvedApplication[]> {
    const invoices = manager.getRepository(Invoice);
    const resolved: ResolvedApplication[] = [];

    for (const wanted of dto.applications) {
      const invoice = await invoices.findOne({
        where: { id: wanted.invoiceId, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      // A draft was never sent and a void'd invoice no longer stands: neither
      // is a document there is anything to credit against.
      if (invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.VOID) {
        throw new BadRequestException(appError('CREDIT_NOTE_INVOICE_NOT_CREDITABLE'));
      }

      const creditable = round2(
        Number(invoice.total) - (await this.creditedSoFar(manager, invoice.id)),
      );
      const requested = round2(wanted.amount ?? creditable);
      if (requested <= 0 || requested > creditable + 0.005) {
        throw new BadRequestException(
          appError('CREDIT_NOTE_EXCEEDS_INVOICE', {
            number: invoice.invoiceNumber ?? invoice.id,
            creditable: creditable.toFixed(2),
          }),
        );
      }

      const lines = await manager
        .getRepository(InvoiceLineItem)
        .find({ where: { invoiceId: invoice.id }, order: { sortOrder: 'ASC' } });
      resolved.push({
        invoice,
        lines,
        // Crediting part of an invoice scales its lines, so each rate keeps its
        // share of the tax instead of the whole credit landing on one line.
        factor: Number(invoice.total) === 0 ? 0 : requested / Number(invoice.total),
      });
    }

    if (new Set(resolved.map(row => row.invoice.clientId)).size > 1) {
      throw new BadRequestException(appError('CREDIT_NOTE_MIXED_CLIENTS'));
    }
    if (new Set(resolved.map(row => row.invoice.currency.toUpperCase())).size > 1) {
      throw new BadRequestException(appError('CREDIT_NOTE_MIXED_CURRENCIES'));
    }
    return resolved;
  }

  private async creditedSoFar(manager: EntityManager, invoiceId: string): Promise<number> {
    const row = await manager
      .getRepository(CreditNoteApplication)
      .createQueryBuilder('application')
      .select('COALESCE(SUM(application.amount), 0)', 'sum')
      .innerJoin(CreditNote, 'note', 'note.id = application.creditNoteId')
      .where('application.invoiceId = :invoiceId', { invoiceId })
      .andWhere('note.status = :status', { status: CreditNoteStatus.ISSUED })
      .getRawOne<{ sum: string }>();
    return round2(Number(row?.sum ?? 0));
  }

  /** The invoice number a credited line carries, so the client can match it. */
  private linePrefix(application: ResolvedApplication): string {
    return `${application.invoice.invoiceNumber ?? application.invoice.id}: `;
  }

  /** The note's lines, kept grouped by the invoice they came off. */
  private async copyLines(
    manager: EntityManager,
    note: CreditNote,
    resolved: ResolvedApplication[],
  ): Promise<Array<{ application: ResolvedApplication; lines: CreditNoteLineItem[] }>> {
    const repo = manager.getRepository(CreditNoteLineItem);
    const groups: Array<{ application: ResolvedApplication; lines: CreditNoteLineItem[] }> = [];
    let sortOrder = 0;
    for (const application of resolved) {
      const rows: CreditNoteLineItem[] = [];
      for (const line of application.lines) {
        const unitPrice = round2(Number(line.unitPrice) * application.factor);
        if (unitPrice === 0) {
          continue;
        }
        rows.push(
          repo.create({
            creditNoteId: note.id,
            // Named after the invoice it comes off, so a note covering three
            // invoices reads line by line.
            description: `${this.linePrefix(application)}${line.description}`,
            quantity: Number(line.quantity),
            unitPrice,
            taxRateId: line.taxRateId,
            categoryId: line.categoryId,
            sortOrder: sortOrder++,
          }),
        );
      }
      groups.push({ application, lines: await repo.save(rows) });
    }
    return groups;
  }

  /**
   * Lowers what the client owes on the invoice, then lets the receivable's own
   * rule decide its status: a part-paid invoice credited down to what has
   * already arrived is paid, and nothing more is owed on it.
   */
  private async reduceReceivable(
    manager: EntityManager,
    workspaceId: string,
    invoice: Invoice,
    amount: number,
  ): Promise<void> {
    if (!invoice.payableId) {
      return;
    }
    const payables = manager.getRepository(Payable);
    const payable = await payables.findOne({
      where: { id: invoice.payableId, workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!payable) {
      return;
    }
    payable.amount = round2(Number(payable.amount) - amount);
    await payables.save(payable);
    await this.payables.recomputeFromPayments(manager, payable.id, workspaceId);
  }

  private async renderPdf(
    manager: EntityManager,
    note: CreditNote,
    lineItems: CreditNoteLineItem[],
    resolved: ResolvedApplication[],
  ): Promise<Buffer> {
    const client = await manager
      .getRepository(Client)
      .findOneOrFail({ where: { id: note.clientId, workspaceId: note.workspaceId } });
    const profile = await this.businessProfile.get(note.workspaceId);
    return buildCreditNotePdf({
      creditNote: note,
      client,
      profile,
      lines: await documentLines(manager, lineItems, note.pricesIncludeTax),
      creditedInvoices: resolved.map(
        row => row.invoice.invoiceNumber ?? row.invoice.id.slice(0, 8),
      ),
      logo: await this.businessProfile.logoDataUri(profile),
    });
  }

  private async nextCreditNoteNumber(manager: EntityManager, workspaceId: string): Promise<string> {
    await manager.query(
      `INSERT INTO "invoice_counters" ("workspace_id") VALUES ($1) ON CONFLICT DO NOTHING`,
      [workspaceId],
    );
    const rows: Array<{ prefix: string; note_no: string }> = await manager.query(
      `WITH taken AS (
         UPDATE "invoice_counters" SET "next_credit_note_no" = "next_credit_note_no" + 1
          WHERE "workspace_id" = $1
          RETURNING "credit_note_prefix" AS "prefix", "next_credit_note_no" - 1 AS "note_no"
       )
       SELECT "prefix", "note_no" FROM taken`,
      [workspaceId],
    );
    return `${rows[0].prefix}${rows[0].note_no}`;
  }
}
