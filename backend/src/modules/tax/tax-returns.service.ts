import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Not, Repository } from 'typeorm';
import { countedWhere } from '../../common/utils/counted-transactions.util';
import { fromMinor, roundHalfAwayFromZero, toMinor } from '../../common/utils/money.util';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import {
  TaxReturn,
  type TaxReturnSnapshotLine,
  TaxReturnStatus,
} from '../../entities/tax-return.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { JurisdictionAdoptionService } from './jurisdiction-adoption.service';
import { JurisdictionsService, toDateOnly } from './jurisdictions.service';
import {
  buildFileName,
  buildTaxReturnPdf,
  buildTaxReturnXlsx,
  type TaxReturnDocumentInput,
} from './tax-return-document';

export interface ReturnTotals {
  outputTax: number;
  inputTax: number;
  netPayable: number;
  currency: string;
  lines: TaxReturnSnapshotLine[];
}

/**
 * Builds and files a period's tax return.
 *
 * A draft is recomputed from the transactions every time it is read, so it
 * always reflects the current data. Filing freezes the figures, writes a
 * line-by-line snapshot and locks the transactions behind it.
 *
 * Reverse-charge rows report their notional figure on both sides, where the
 * two entries cancel and leave the net unchanged.
 */
@Injectable()
export class TaxReturnsService {
  private readonly logger = new Logger(TaxReturnsService.name);

  constructor(
    @InjectRepository(TaxReturn)
    private readonly returnRepository: Repository<TaxReturn>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly adoptionService: JurisdictionAdoptionService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly jurisdictionsService: JurisdictionsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Records a filing-status change against the persisted return row. Audit
   * failure is logged, never allowed to undo a filing that already committed.
   */
  private async recordStatusChange(
    workspaceId: string,
    userId: string | undefined,
    before: TaxReturn | null,
    after: TaxReturn,
    severity?: Severity,
  ): Promise<void> {
    const snapshot = (row: TaxReturn) => ({
      status: row.status,
      filedAt: row.filedAt ?? null,
      outputTax: row.outputTax,
      inputTax: row.inputTax,
      netPayable: row.netPayable,
      currency: row.currency,
    });

    try {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId ?? null,
        entityType: EntityType.TAX_RETURN,
        entityId: after.id,
        action: AuditAction.UPDATE,
        diff: { before: before ? snapshot(before) : null, after: snapshot(after) },
        meta: { periodStart: after.periodStart, periodEnd: after.periodEnd, status: after.status },
        ...(severity ? { severity } : {}),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for tax return ${after.id}: ${message}`);
    }
  }

  /**
   * Totals for a period, in the jurisdiction's currency.
   *
   * Every transaction is converted at the rate for its own date. Converting at
   * today's rate would make a filed return drift with the market, and would
   * give a different answer each time it was opened.
   */
  async computeTotals(
    workspaceId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<ReturnTotals> {
    const jurisdiction = await this.adoptionService.getCurrentJurisdiction(workspaceId);
    if (!jurisdiction) {
      throw new BadRequestException(
        'This workspace has no tax jurisdiction. Pick a country before building a return.',
      );
    }

    const transactions = await this.transactionRepository.find({
      // A transfer between the user's own accounts is not a taxable supply.
      where: countedWhere({
        workspaceId,
        transferPairId: IsNull(),
        transactionDate: Between(new Date(periodStart), new Date(periodEnd)),
        taxAmount: Not(null as never),
      }),
      order: { transactionDate: 'ASC' },
    });

    const currency = jurisdiction.currency;
    let outputMinor = 0;
    let inputMinor = 0;
    const lines: TaxReturnSnapshotLine[] = [];

    for (const transaction of transactions) {
      // Under reverse charge nothing was charged, so the figure the return
      // reports is the notional one — on both sides, where the two entries
      // cancel and leave the net unchanged.
      const isReverseCharge = transaction.taxReverseCharge === true;
      const taxAmount = isReverseCharge
        ? Number(transaction.taxNotionalAmount ?? 0)
        : Number(transaction.taxAmount ?? 0);

      if (!Number.isFinite(taxAmount) || taxAmount === 0) {
        continue;
      }

      const from = (transaction.currency || currency).toUpperCase();
      const rate =
        from === currency
          ? 1
          : await this.exchangeRatesService.getRate(
              from,
              currency,
              new Date(transaction.transactionDate),
              workspaceId,
            );

      // Rounded once, on the converted figure, so the line and the total agree.
      const convertedMinor = roundHalfAwayFromZero(toMinor(taxAmount) * rate);
      const isOutput = transaction.transactionType === TransactionType.INCOME;

      if (isReverseCharge) {
        outputMinor += convertedMinor;
        inputMinor += convertedMinor;
      } else if (isOutput) {
        outputMinor += convertedMinor;
      } else {
        inputMinor += convertedMinor;
      }

      lines.push({
        transactionId: transaction.id,
        date: toDateOnly(transaction.transactionDate),
        counterparty: transaction.counterpartyName,
        direction: isReverseCharge ? 'reverse_charge' : isOutput ? 'output' : 'input',
        currency: from,
        taxAmount,
        netAmount: Number(transaction.taxNetAmount ?? 0),
        exchangeRate: rate,
        taxAmountConverted: fromMinor(convertedMinor),
      });
    }

    return {
      outputTax: fromMinor(outputMinor),
      inputTax: fromMinor(inputMinor),
      netPayable: fromMinor(outputMinor - inputMinor),
      currency,
      lines,
    };
  }

  async findAll(workspaceId: string): Promise<TaxReturn[]> {
    return this.returnRepository.find({
      where: { workspaceId },
      order: { periodStart: 'DESC' },
    });
  }

  /**
   * The return for a period, recomputed when it is still a draft.
   *
   * A filed return is returned exactly as it was submitted: recomputing it
   * would show figures that differ from the ones sent to the tax authority.
   */
  async getForPeriod(
    workspaceId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<TaxReturn> {
    if (periodEnd < periodStart) {
      throw new BadRequestException('Period end must not be before period start');
    }

    const existing = await this.returnRepository.findOne({
      where: { workspaceId, periodStart, periodEnd },
    });

    if (existing?.status === TaxReturnStatus.FILED) {
      return existing;
    }

    const totals = await this.computeTotals(workspaceId, periodStart, periodEnd);
    const jurisdiction = await this.adoptionService.getCurrentJurisdiction(workspaceId);

    const draft = this.returnRepository.create({
      ...(existing ?? {}),
      workspaceId,
      // biome-ignore lint/style/noNonNullAssertion: computeTotals already threw if absent.
      jurisdictionId: jurisdiction!.id,
      periodStart,
      periodEnd,
      status: TaxReturnStatus.DRAFT,
      outputTax: totals.outputTax,
      inputTax: totals.inputTax,
      netPayable: totals.netPayable,
      currency: totals.currency,
      filedAt: null,
      snapshot: null,
    });

    return this.returnRepository.save(draft);
  }

  /**
   * Files a period.
   *
   * Everything happens in one database transaction: the snapshot and the row
   * locks must land together, or a crash between them would leave a return
   * claiming to be filed over transactions that are still editable.
   */
  async file(
    workspaceId: string,
    periodStart: string,
    periodEnd: string,
    userId?: string,
  ): Promise<TaxReturn> {
    const existing = await this.returnRepository.findOne({
      where: { workspaceId, periodStart, periodEnd },
    });

    if (existing?.status === TaxReturnStatus.FILED) {
      throw new ConflictException('This period has already been filed');
    }

    const totals = await this.computeTotals(workspaceId, periodStart, periodEnd);
    const jurisdiction = await this.adoptionService.getCurrentJurisdiction(workspaceId);

    const filed = await this.returnRepository.manager.transaction(async manager => {
      const saved = await manager.save(TaxReturn, {
        ...(existing ?? {}),
        workspaceId,
        // biome-ignore lint/style/noNonNullAssertion: computeTotals already threw if absent.
        jurisdictionId: jurisdiction!.id,
        periodStart,
        periodEnd,
        status: TaxReturnStatus.FILED,
        outputTax: totals.outputTax,
        inputTax: totals.inputTax,
        netPayable: totals.netPayable,
        currency: totals.currency,
        filedAt: new Date(),
        snapshot: totals.lines,
      });

      const transactionIds = totals.lines.map(line => line.transactionId);
      if (transactionIds.length > 0) {
        await manager
          .createQueryBuilder()
          .update(Transaction)
          .set({ taxLocked: true })
          .whereInIds(transactionIds)
          .execute();
      }

      this.logger.log(
        `Filed ${periodStart}..${periodEnd} for workspace ${workspaceId}: ` +
          `${totals.netPayable} ${totals.currency} over ${transactionIds.length} transactions`,
      );

      return saved;
    });

    await this.recordStatusChange(workspaceId, userId, existing, filed);
    return filed;
  }

  /**
   * Reopens a filed period.
   *
   * Kept deliberately explicit rather than allowing a silent recompute: it
   * unlocks the transactions and discards the record of what was submitted, so
   * it should be a decision, not a side effect of editing something.
   */
  async reopen(
    workspaceId: string,
    periodStart: string,
    periodEnd: string,
    userId?: string,
  ): Promise<TaxReturn> {
    const existing = await this.returnRepository.findOne({
      where: { workspaceId, periodStart, periodEnd },
    });

    if (!existing || existing.status !== TaxReturnStatus.FILED) {
      throw new BadRequestException('This period is not filed');
    }

    const lockedIds = (existing.snapshot ?? []).map(line => line.transactionId);

    const reopened = await this.returnRepository.manager.transaction(async manager => {
      if (lockedIds.length > 0) {
        await manager
          .createQueryBuilder()
          .update(Transaction)
          .set({ taxLocked: false })
          .whereInIds(lockedIds)
          .execute();
      }

      return manager.save(TaxReturn, {
        ...existing,
        status: TaxReturnStatus.DRAFT,
        filedAt: null,
        snapshot: null,
      });
    });

    // Reopening unlocks transactions and discards what was submitted, so it is
    // flagged for review rather than logged as routine.
    await this.recordStatusChange(workspaceId, userId, existing, reopened, Severity.WARN);
    return reopened;
  }

  /**
   * Everything a document needs for a period.
   *
   * A filed return is rendered from its snapshot and its own jurisdiction, not
   * from today's data or today's country: the document has to show what was
   * submitted, even if the workspace has since moved elsewhere.
   */
  async buildDocumentInput(
    workspaceId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<TaxReturnDocumentInput> {
    const record = await this.getForPeriod(workspaceId, periodStart, periodEnd);
    const isFiled = record.status === TaxReturnStatus.FILED;

    const jurisdiction = isFiled
      ? await this.jurisdictionsService.findById(record.jurisdictionId)
      : await this.adoptionService.getCurrentJurisdiction(workspaceId);

    const lines = isFiled
      ? (record.snapshot ?? [])
      : (await this.computeTotals(workspaceId, periodStart, periodEnd)).lines;

    return {
      jurisdictionName: jurisdiction?.name ?? '—',
      taxName: jurisdiction?.taxName ?? '',
      periodStart,
      periodEnd,
      status: isFiled ? 'filed' : 'draft',
      filedAt: record.filedAt ? new Date(record.filedAt).toISOString().slice(0, 10) : null,
      currency: record.currency,
      outputTax: Number(record.outputTax),
      inputTax: Number(record.inputTax),
      netPayable: Number(record.netPayable),
      lines,
    };
  }

  async export(
    workspaceId: string,
    periodStart: string,
    periodEnd: string,
    format: 'pdf' | 'xlsx',
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    const input = await this.buildDocumentInput(workspaceId, periodStart, periodEnd);

    if (format === 'pdf') {
      return {
        buffer: await buildTaxReturnPdf(input),
        fileName: buildFileName(input, 'pdf'),
        contentType: 'application/pdf',
      };
    }

    return {
      buffer: buildTaxReturnXlsx(input),
      fileName: buildFileName(input, 'xlsx'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
