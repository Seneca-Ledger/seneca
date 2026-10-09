import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository, type SelectQueryBuilder } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { fromMinor, roundHalfAwayFromZero, toMinor } from '../../common/utils/money.util';
import {
  ActorType,
  AuditAction,
  type AuditEventMeta,
  EntityType,
} from '../../entities/audit-event.entity';
import { Category } from '../../entities/category.entity';
import { IncomeTaxLineMapping } from '../../entities/income-tax-line-mapping.entity';
import { IncomeTaxProfile } from '../../entities/income-tax-profile.entity';
import { StatementStatus } from '../../entities/statement.entity';
import type { TaxJurisdiction } from '../../entities/tax-jurisdiction.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { JurisdictionAdoptionService } from '../tax/jurisdiction-adoption.service';
import { toDateOnly } from '../tax/jurisdictions.service';
import { type BdiRates, BdiRatesService, referenceRateFor } from './bdi-rates.service';
import { filingInfoFor } from './filing-info';
import type { DraftContribution, DraftSignals, IncomeTaxDraft } from './income-tax.types';
import { IncomeTaxCompletenessService, taxYearBounds } from './income-tax-completeness.service';
import { CURRENT_TAX_DISCLAIMER_VERSION } from './income-tax-disclaimer.service';
import { type NbpRate, NbpRatesService, previousBusinessDayRate } from './nbp-rates.service';
import {
  type FormLine,
  genericSummaryPack,
  type LineItem,
  type LineSection,
  type RulePack,
  resolvePack,
  suggestLine,
  type TaxpayerType,
} from './rule-packs';
import { type FxRule, fxRuleFor } from './rule-packs/fx-rules';

export interface IncomeTaxProfileView {
  taxYear: number;
  taxpayerType: TaxpayerType;
  details: Record<string, unknown>;
}

export interface MappingEntry {
  categoryId: string;
  lineKey: string | null;
}

export type MappingStatus = 'confirmed' | 'suggested' | 'unmapped';

/** A rate and the day it belongs to, which under NBP rules is not the transaction's day. */
interface FxQuote {
  rate: number;
  rateDate: string;
}

function packMeta(pack: RulePack): IncomeTaxDraft['pack'] {
  return {
    formKey: pack.formKey,
    name: pack.name,
    countryCode: pack.countryCode,
    formEditionYear: pack.formEditionYear,
    filingChannel: pack.filingChannel,
    isGeneric: pack === genericSummaryPack,
  };
}

/** The transaction's size, whichever column the importer filled. */
function transactionAmount(transaction: Transaction): number {
  const raw =
    transaction.amount ??
    (transaction.transactionType === TransactionType.INCOME
      ? transaction.credit
      : transaction.debit);
  const value = Math.abs(Number(raw ?? 0));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Money moving in the line's own direction adds to it; the other way reduces
 * it. A supplier refund booked to "Rent" lowers rent rather than becoming income.
 */
function directionSign(section: LineSection, type: TransactionType): 1 | -1 {
  if (section === 'income') {
    return type === TransactionType.INCOME ? 1 : -1;
  }
  return type === TransactionType.EXPENSE ? 1 : -1;
}

/**
 * Builds the income-tax draft for a workspace and year.
 *
 * Only categories the user has confirmed against a form line contribute.
 * Proposals are shown, never counted: deciding which line a document belongs
 * to is the taxpayer's call, and a figure built on our guess could not be
 * defended by them.
 */
@Injectable()
export class IncomeTaxDraftService {
  private readonly logger = new Logger(IncomeTaxDraftService.name);

  constructor(
    @InjectRepository(IncomeTaxProfile)
    private readonly profileRepository: Repository<IncomeTaxProfile>,
    @InjectRepository(IncomeTaxLineMapping)
    private readonly mappingRepository: Repository<IncomeTaxLineMapping>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly adoptionService: JurisdictionAdoptionService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly completenessService: IncomeTaxCompletenessService,
    private readonly nbpRatesService: NbpRatesService,
    private readonly bdiRatesService: BdiRatesService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Profile and mapping edits change how a year is declared but live on their
   * own rows, not on the return, so they are logged against the workspace with
   * the tax year in meta. Audit failure is logged, never allowed to fail the save.
   */
  private async recordDeclarationChange(
    workspaceId: string,
    userId: string | undefined,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    meta: AuditEventMeta,
  ): Promise<void> {
    try {
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId ?? null,
        entityType: EntityType.TAX_RETURN,
        entityId: workspaceId,
        action: AuditAction.UPDATE,
        diff: { before, after },
        meta,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for income-tax ${String(meta.kind)}: ${message}`);
    }
  }

  async getProfile(workspaceId: string, taxYear: number): Promise<IncomeTaxProfileView> {
    const profile = await this.profileRepository.findOne({ where: { workspaceId, taxYear } });
    return {
      taxYear,
      taxpayerType: profile?.taxpayerType ?? 'self_employed',
      details: profile?.details ?? {},
    };
  }

  /** Profile plus what it resolves to, without failing when no country is set. */
  async getProfileOverview(workspaceId: string, taxYear: number) {
    const [profile, jurisdiction] = await Promise.all([
      this.getProfile(workspaceId, taxYear),
      this.adoptionService.getCurrentJurisdiction(workspaceId),
    ]);
    return {
      ...profile,
      country: jurisdiction ? { code: jurisdiction.code, name: jurisdiction.name } : null,
      currency: jurisdiction?.currency ?? null,
      pack: jurisdiction
        ? packMeta(resolvePack(jurisdiction.code, taxYear, profile.taxpayerType, profile.details))
        : null,
      filingInfo: jurisdiction
        ? filingInfoFor(jurisdiction.code, taxYear, profile.taxpayerType, profile.details)
        : null,
    };
  }

  async saveProfile(
    workspaceId: string,
    taxYear: number,
    taxpayerType: TaxpayerType,
    details: Record<string, unknown>,
    userId?: string,
  ) {
    const before = await this.getProfile(workspaceId, taxYear);
    await this.profileRepository.upsert({ workspaceId, taxYear, taxpayerType, details }, [
      'workspaceId',
      'taxYear',
    ]);
    await this.recordDeclarationChange(
      workspaceId,
      userId,
      { taxpayerType: before.taxpayerType, details: before.details },
      { taxpayerType, details },
      { kind: 'income_tax_profile', taxYear },
    );
    return this.getProfileOverview(workspaceId, taxYear);
  }

  async getContext(
    workspaceId: string,
    taxYear: number,
  ): Promise<{ jurisdiction: TaxJurisdiction; profile: IncomeTaxProfileView; pack: RulePack }> {
    const jurisdiction = await this.adoptionService.getCurrentJurisdiction(workspaceId);
    if (!jurisdiction) {
      throw new BadRequestException({
        code: 'TAX_JURISDICTION_REQUIRED',
        message: 'This workspace has no tax country. Pick one in the workspace settings first.',
      });
    }
    const profile = await this.getProfile(workspaceId, taxYear);
    return {
      jurisdiction,
      profile,
      pack: resolvePack(jurisdiction.code, taxYear, profile.taxpayerType, profile.details),
    };
  }

  async getMappings(workspaceId: string, taxYear: number) {
    const { pack } = await this.getContext(workspaceId, taxYear);
    const lineKeys = new Set(pack.lines.map(line => line.key));

    const [categories, confirmed, usage] = await Promise.all([
      this.categoryRepository.find({ where: { workspaceId }, order: { name: 'ASC' } }),
      this.mappingRepository.find({ where: { workspaceId, formKey: pack.formKey } }),
      this.countByCategory(workspaceId, taxYear),
    ]);
    const confirmedByCategory = new Map(
      confirmed.filter(m => lineKeys.has(m.lineKey)).map(m => [m.categoryId, m]),
    );

    return {
      formKey: pack.formKey,
      lines: pack.lines,
      categories: categories.map(category => {
        const mapping = confirmedByCategory.get(category.id);
        const suggested = mapping ? null : suggestLine(pack, category.name);
        const status: MappingStatus = mapping ? 'confirmed' : suggested ? 'suggested' : 'unmapped';
        return {
          categoryId: category.id,
          name: category.name,
          type: category.type,
          isSystem: category.isSystem,
          transactionCount: usage.get(category.id) ?? 0,
          lineKey: mapping?.lineKey ?? suggested,
          status,
        };
      }),
    };
  }

  /** Confirms (or, with a NULL line, withdraws) category → line assignments. */
  async saveMappings(
    workspaceId: string,
    userId: string,
    taxYear: number,
    entries: MappingEntry[],
  ) {
    const { pack } = await this.getContext(workspaceId, taxYear);
    const lineKeys = new Set(pack.lines.map(line => line.key));

    // Last entry wins: a single upsert may not touch the same row twice.
    const byCategory = new Map(entries.map(entry => [entry.categoryId, entry.lineKey]));
    for (const lineKey of byCategory.values()) {
      if (lineKey !== null && !lineKeys.has(lineKey)) {
        throw new BadRequestException(`Unknown line '${lineKey}' for form ${pack.formKey}`);
      }
    }

    const categoryIds = [...byCategory.keys()];
    if (categoryIds.length > 0) {
      const owned = await this.categoryRepository.count({
        where: { workspaceId, id: In(categoryIds) },
      });
      if (owned !== categoryIds.length) {
        throw new BadRequestException('One or more categories do not belong to this workspace');
      }
    }

    const previous =
      categoryIds.length > 0
        ? await this.mappingRepository.find({
            where: { workspaceId, formKey: pack.formKey, categoryId: In(categoryIds) },
          })
        : [];
    const previousByCategory = new Map(previous.map(m => [m.categoryId, m.lineKey]));

    await this.mappingRepository.manager.transaction(async manager => {
      const withdrawn = categoryIds.filter(id => byCategory.get(id) === null);
      if (withdrawn.length > 0) {
        await manager.delete(IncomeTaxLineMapping, {
          workspaceId,
          formKey: pack.formKey,
          categoryId: In(withdrawn),
        });
      }

      const confirmedAt = new Date();
      const rows = categoryIds
        .filter(id => byCategory.get(id) !== null)
        .map(categoryId => ({
          workspaceId,
          formKey: pack.formKey,
          categoryId,
          lineKey: byCategory.get(categoryId) as string,
          confirmedBy: userId,
          confirmedAt,
        }));
      if (rows.length > 0) {
        await manager.upsert(IncomeTaxLineMapping, rows, ['workspaceId', 'formKey', 'categoryId']);
      }
    });

    // Only the assignments that actually moved, keyed by category, to keep the
    // diff compact when a whole form is resubmitted.
    const before: Record<string, string | null> = {};
    const after: Record<string, string | null> = {};
    for (const categoryId of categoryIds) {
      const from = previousByCategory.get(categoryId) ?? null;
      const to = byCategory.get(categoryId) ?? null;
      if (from !== to) {
        before[categoryId] = from;
        after[categoryId] = to;
      }
    }
    if (Object.keys(after).length > 0) {
      await this.recordDeclarationChange(workspaceId, userId, before, after, {
        kind: 'income_tax_mappings',
        taxYear,
        formKey: pack.formKey,
        changedCategoryIds: Object.keys(after),
      });
    }

    return this.getMappings(workspaceId, taxYear);
  }

  async compute(workspaceId: string, taxYear: number): Promise<IncomeTaxDraft> {
    const { jurisdiction, profile, pack } = await this.getContext(workspaceId, taxYear);
    const currency = jurisdiction.currency.toUpperCase();

    const [transactions, mappings] = await Promise.all([
      this.yearTransactions(workspaceId, taxYear)
        .leftJoinAndSelect('t.category', 'c')
        .orderBy('t.transactionDate', 'ASC')
        .addOrderBy('t.id', 'ASC')
        .getMany(),
      this.mappingRepository.find({ where: { workspaceId, formKey: pack.formKey } }),
    ]);

    const lineByKey = new Map(pack.lines.map(line => [line.key, line]));
    const lineByCategory = new Map<string, FormLine>();
    for (const mapping of mappings) {
      const line = lineByKey.get(mapping.lineKey);
      if (line) {
        lineByCategory.set(mapping.categoryId, line);
      }
    }

    const items: Record<string, LineItem[]> = {};
    const contributions: Record<string, DraftContribution[]> = {};
    const unmapped = new Map<
      string,
      { categoryId: string; name: string; transactionCount: number }
    >();
    const missingFxCurrencies = new Set<string>();
    const fxRule = fxRuleFor(jurisdiction.code);
    const rateCache = new Map<string, FxQuote | null>();
    const nbpTables = new Map<string, NbpRate[] | null>();
    const bdiTables = new Map<string, BdiRates | null>();
    let uncategorizedCount = 0;
    let missingFxCount = 0;

    for (const transaction of transactions) {
      if (!transaction.categoryId) {
        uncategorizedCount++;
        continue;
      }

      const line = lineByCategory.get(transaction.categoryId);
      if (!line) {
        const entry = unmapped.get(transaction.categoryId) ?? {
          categoryId: transaction.categoryId,
          name: transaction.category?.name ?? '—',
          transactionCount: 0,
        };
        entry.transactionCount++;
        unmapped.set(transaction.categoryId, entry);
        continue;
      }
      if (line.section === 'excluded') {
        continue;
      }

      const amount = transactionAmount(transaction);
      if (amount === 0) {
        continue;
      }

      const date = toDateOnly(transaction.transactionDate);
      const from = (transaction.currency || currency).toUpperCase();
      const quote = await this.rateFor(from, currency, date, {
        workspaceId,
        taxYear,
        fxRule,
        cache: rateCache,
        nbpTables,
        bdiTables,
      });
      if (quote === null) {
        missingFxCount++;
        missingFxCurrencies.add(from);
        continue;
      }

      const rate = quote.rate;
      const sign = directionSign(line.section, transaction.transactionType);
      const convertedMinor = sign * roundHalfAwayFromZero(toMinor(amount) * rate);

      if (!items[line.key]) {
        items[line.key] = [];
        contributions[line.key] = [];
      }
      items[line.key].push({
        counterparty: transaction.counterpartyName ?? '',
        amountMinor: convertedMinor,
      });
      contributions[line.key].push({
        transactionId: transaction.id,
        date,
        counterparty: transaction.counterpartyName,
        categoryName: transaction.category?.name ?? null,
        currency: from,
        amount: sign * amount,
        exchangeRate: rate,
        rateDate: quote.rateDate,
        amountConverted: fromMinor(convertedMinor),
      });
    }

    const result = pack.compute({ taxYear, items, details: profile.details });

    const warnings = [...result.warnings];
    if (pack.formEditionYear !== null && taxYear > pack.formEditionYear) {
      warnings.unshift({
        code: 'form_edition_older',
        params: { formEditionYear: pack.formEditionYear },
      });
    }

    const unmappedCategories = [...unmapped.values()];
    const signals: DraftSignals = {
      transactionCount: transactions.length,
      uncategorizedCount,
      unmappedTransactionCount: unmappedCategories.reduce((n, c) => n + c.transactionCount, 0),
      unmappedCategories,
      missingFxCount,
      missingFxCurrencies: [...missingFxCurrencies],
    };
    const completeness = await this.completenessService.check(workspaceId, taxYear, signals);

    return {
      taxYear,
      status: 'draft',
      finalizedAt: null,
      country: { code: jurisdiction.code, name: jurisdiction.name },
      currency,
      taxpayerType: profile.taxpayerType,
      details: profile.details,
      pack: packMeta(pack),
      lines: pack.lines,
      figures: result.figures.map(figure => ({
        key: figure.key,
        lineNo: figure.lineNo,
        fieldNo: figure.fieldNo,
        label: figure.label,
        section: figure.section,
        amount: fromMinor(figure.amountMinor),
        deductible: fromMinor(figure.deductibleMinor),
        transactionCount: contributions[figure.key]?.length ?? 0,
      })),
      warnings,
      taxEstimate: result.taxEstimate
        ? {
            amount: fromMinor(result.taxEstimate.amountMinor),
            basis: result.taxEstimate.basis,
            excludes: result.taxEstimate.excludes,
          }
        : null,
      completeness,
      disclaimerVersion: CURRENT_TAX_DISCLAIMER_VERSION,
      fxRule,
      filingInfo: filingInfoFor(jurisdiction.code, taxYear, profile.taxpayerType, profile.details),
      contributions,
    };
  }

  /**
   * Transactions that belong to the year: confirmed, not duplicates, and either
   * entered by hand or from a statement that is neither deleted nor failed. Unlike the
   * dashboard, rows without a statement count — cash expenses entered manually
   * are often exactly the deductible ones.
   */
  private yearTransactions(workspaceId: string, taxYear: number): SelectQueryBuilder<Transaction> {
    const { yearStart, yearEnd } = taxYearBounds(taxYear);
    return onlyCounted(
      this.transactionRepository
        .createQueryBuilder('t')
        .leftJoin('t.statement', 's')
        .where('t.workspaceId = :workspaceId', { workspaceId })
        .andWhere('t.isDuplicate = false')
        .andWhere('t.transferPairId IS NULL')
        .andWhere('t.transactionDate BETWEEN :yearStart AND :yearEnd', { yearStart, yearEnd })
        .andWhere(
          '(t.statementId IS NULL OR (s.id IS NOT NULL AND s.deletedAt IS NULL AND s.status NOT IN (:...excludedStatuses)))',
          { excludedStatuses: [StatementStatus.ERROR, StatementStatus.PROCESSING] },
        ),
      't',
    );
  }

  private async countByCategory(
    workspaceId: string,
    taxYear: number,
  ): Promise<Map<string, number>> {
    const rows = await this.yearTransactions(workspaceId, taxYear)
      .select('t.categoryId', 'categoryId')
      .addSelect('COUNT(*)::int', 'count')
      .andWhere('t.categoryId IS NOT NULL')
      .groupBy('t.categoryId')
      .getRawMany<{ categoryId: string; count: number }>();
    return new Map(rows.map(row => [row.categoryId, Number(row.count)]));
  }

  /**
   * The rate for one transaction under the country's rule.
   *
   * Under art. 11a (Poland) that is NBP's table A rate of the last business day
   * before the transaction; in Italy, Banca d'Italia's reference rate of the day
   * or the nearest earlier day, else the monthly average. Each year's rates are
   * fetched once per currency. Elsewhere it is the rate for the transaction's
   * own date — an assumption the draft states, since no other country's
   * official rule has been verified.
   */
  private async rateFor(
    from: string,
    to: string,
    date: string,
    context: {
      workspaceId: string;
      taxYear: number;
      fxRule: FxRule;
      cache: Map<string, FxQuote | null>;
      nbpTables: Map<string, NbpRate[] | null>;
      bdiTables: Map<string, BdiRates | null>;
    },
  ): Promise<FxQuote | null> {
    if (from === to) {
      return { rate: 1, rateDate: date };
    }

    if (context.fxRule === 'bdi_reference_rate' && to === 'EUR') {
      if (!context.bdiTables.has(from)) {
        context.bdiTables.set(from, await this.bdiRatesService.getYearRates(from, context.taxYear));
      }
      const table = context.bdiTables.get(from);
      const quote = table ? referenceRateFor(table, date) : null;
      // Quoted as units of the currency per euro, so one unit is worth its inverse.
      return quote ? { rate: 1 / quote.perEuro, rateDate: quote.rateDate } : null;
    }

    if (context.fxRule === 'nbp_previous_business_day' && to === 'PLN') {
      if (!context.nbpTables.has(from)) {
        context.nbpTables.set(from, await this.nbpRatesService.getYearRates(from, context.taxYear));
      }
      const table = context.nbpTables.get(from);
      const nbpRate = table ? previousBusinessDayRate(table, date) : null;
      return nbpRate ? { rate: nbpRate.mid, rateDate: nbpRate.effectiveDate } : null;
    }

    const key = `${from}:${date}`;
    if (!context.cache.has(key)) {
      const rate = await this.exchangeRatesService.getRateOrNull(
        from,
        to,
        date,
        context.workspaceId,
      );
      context.cache.set(key, rate === null ? null : { rate, rateDate: date });
    }
    return context.cache.get(key) ?? null;
  }
}
