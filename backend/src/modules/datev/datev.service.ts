import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { APP_NAME } from '../../common/brand';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { toMinor } from '../../common/utils/money.util';
import {
  canReadPrivate,
  PRIVACY_VIEWER_PARAM,
  readablePrivateSql,
} from '../../common/utils/transaction-privacy.util';
import { readWorkspaceProfile } from '../../common/utils/workspace-profile.util';
import { Category } from '../../entities/category.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { VatStatus, Workspace } from '../../entities/workspace.entity';
import {
  WorkspaceServiceSettings,
  WorkspaceServiceSettingsKey,
} from '../../entities/workspace-service-settings.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { toDateOnly } from '../tax/jurisdictions.service';
import {
  accountFor,
  automaticRate,
  DATEV_CONCEPTS,
  type DatevChart,
  type DatevConceptKey,
  suggestedConcept,
} from './datev-accounts';
import { type DatevBooking, datevFileContent, encodeWindows1252 } from './datev-format';

/** DATEV is a German (and Austrian) adviser system; elsewhere the export is not offered. */
const DATEV_COUNTRIES: ReadonlySet<string> = new Set(['DE', 'AT']);
const ACCOUNT_PATTERN = /^[0-9]{1,9}$/;
const MAX_BOOKINGS = 99_999;

export interface DatevSettings {
  /** The export makes sense here: a business in Germany or Austria. */
  available: boolean;
  chart: DatevChart;
  consultantNumber: number | null;
  clientNumber: number | null;
  bankAccount: string;
  accounts: Record<string, string>;
  /** Statement account number (IBAN) → DATEV account, for a business with several bank accounts. */
  bankAccounts: Record<string, string>;
}

export interface DatevMapping {
  categories: DatevMappingRow[];
  /** The bank accounts the year's statements came from, and the DATEV account each books to. */
  bankAccounts: Array<{ accountNumber: string; transactionCount: number; account: string | null }>;
}

export interface DatevMappingRow {
  categoryId: string;
  name: string;
  type: 'income' | 'expense';
  transactionCount: number;
  account: string | null;
  suggestion: { concept: DatevConceptKey; account: string; name: string } | null;
}

export type DatevIssue =
  | {
      kind: 'automatic_rate_mismatch';
      transactionId: string;
      account: string;
      accountRate: number;
      rate: number;
    }
  | { kind: 'unsupported_rate'; transactionId: string; rate: number };

export interface DatevPreview {
  bookings: number;
  skipped: {
    uncategorized: number;
    unmapped: Array<{ categoryId: string; name: string; count: number }>;
    /** Rows in another currency with no exchange rate for their day. */
    foreignCurrency: number;
  };
  /** Rows in another currency, converted to euros at the rate of their day. */
  converted: number;
  issues: DatevIssue[];
  /** What is missing before a file can be made: the numbers DATEV matches a file to a client by. */
  missingSettings: Array<'consultantNumber' | 'clientNumber'>;
}

interface Built {
  bookings: DatevBooking[];
  preview: DatevPreview;
}

/**
 * Books the period's transactions as a DATEV Buchungsstapel for the user's
 * tax adviser: each row against the bank account, with the account its
 * category is mapped to, and the tax key DATEV expects for its VAT.
 *
 * Only confirmed category mappings are exported — choosing the account is
 * bookkeeping the user or the adviser decides (StBerG § 2), so a suggestion
 * never goes out on its own.
 */
@Injectable()
export class DatevService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceServiceSettings)
    private readonly settingsRepository: Repository<WorkspaceServiceSettings>,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getSettings(workspaceId: string): Promise<DatevSettings> {
    const [row, workspace] = await Promise.all([
      this.settingsRepository.findOne({
        where: { workspaceId, key: WorkspaceServiceSettingsKey.DATEV },
      }),
      this.loadWorkspace(workspaceId),
    ]);
    const config = (row?.config ?? {}) as Partial<DatevSettings>;
    const chart: DatevChart = config.chart === '04' ? '04' : '03';
    return {
      available:
        DATEV_COUNTRIES.has(workspace.taxJurisdiction?.code ?? '') &&
        readWorkspaceProfile(workspace) !== 'home',
      chart,
      consultantNumber: config.consultantNumber ?? null,
      clientNumber: config.clientNumber ?? null,
      bankAccount: config.bankAccount ?? accountFor('bank', chart),
      accounts: config.accounts ?? {},
      bankAccounts: config.bankAccounts ?? {},
    };
  }

  async saveSettings(
    workspaceId: string,
    input: {
      chart: DatevChart;
      consultantNumber: number | null;
      clientNumber: number | null;
      bankAccount: string | null;
      accounts?: Record<string, string>;
      bankAccounts?: Record<string, string>;
    },
    userId?: string,
  ): Promise<DatevSettings> {
    const current = await this.getSettings(workspaceId);
    // A mapping belongs to one chart: the same number means something else in the other.
    const sameChart = input.chart === current.chart;
    const accounts = input.accounts ?? (sameChart ? current.accounts : {});
    const bankAccounts = input.bankAccounts ?? (sameChart ? current.bankAccounts : {});
    for (const account of Object.values(bankAccounts)) {
      if (!ACCOUNT_PATTERN.test(account)) {
        throw new BadRequestException('A bank account must be 1–9 digits');
      }
    }
    const ids = Object.keys(accounts);
    for (const [categoryId, account] of Object.entries(accounts)) {
      if (!ACCOUNT_PATTERN.test(account)) {
        throw new BadRequestException(`Account for category ${categoryId} must be 1–9 digits`);
      }
    }
    if (ids.length > 0) {
      const owned = await this.categoryRepository.count({ where: { workspaceId, id: In(ids) } });
      if (owned !== ids.length) {
        throw new BadRequestException('One or more categories do not belong to this workspace');
      }
    }

    const existing = await this.settingsRepository.findOne({
      where: { workspaceId, key: WorkspaceServiceSettingsKey.DATEV },
    });
    await this.settingsRepository.save({
      ...(existing ?? {}),
      workspaceId,
      key: WorkspaceServiceSettingsKey.DATEV,
      config: {
        chart: input.chart,
        consultantNumber: input.consultantNumber,
        clientNumber: input.clientNumber,
        bankAccount: input.bankAccount,
        accounts,
        bankAccounts,
      },
      updatedByUserId: userId ?? null,
    });
    return this.getSettings(workspaceId);
  }

  /** Every category the year booked to, its account if mapped, and a suggestion if not. */
  async getMapping(
    workspaceId: string,
    year: number,
    viewerMemberId: string | null = null,
  ): Promise<DatevMapping> {
    const [settings, workspace] = await Promise.all([
      this.getSettings(workspaceId),
      this.loadWorkspace(workspaceId),
    ]);
    const counts: Array<{ categoryId: string; count: string }> = await onlyCounted(
      this.transactionRepository
        .createQueryBuilder('t')
        .select('t.categoryId', 'categoryId')
        .addSelect('COUNT(*)', 'count')
        .where('t.workspaceId = :workspaceId', { workspaceId })
        .andWhere('t.categoryId IS NOT NULL')
        .andWhere('t.transferPairId IS NULL')
        // Counts what the export would book for this viewer, which leaves
        // other members' private rows out.
        .andWhere(readablePrivateSql('t'), { [PRIVACY_VIEWER_PARAM]: viewerMemberId })
        .andWhere('t.transactionDate BETWEEN :from AND :to', {
          from: `${year}-01-01`,
          to: `${year}-12-31`,
        }),
      't',
    )
      .groupBy('t.categoryId')
      .getRawMany();
    const sources: Array<{ accountNumber: string; count: string }> = await onlyCounted(
      this.transactionRepository
        .createQueryBuilder('t')
        .innerJoin('t.statement', 's')
        .select('s.accountNumber', 'accountNumber')
        .addSelect('COUNT(*)', 'count')
        .where('t.workspaceId = :workspaceId', { workspaceId })
        .andWhere("COALESCE(s.accountNumber, '') <> ''")
        .andWhere('t.transferPairId IS NULL')
        .andWhere(readablePrivateSql('t'), { [PRIVACY_VIEWER_PARAM]: viewerMemberId })
        .andWhere('t.transactionDate BETWEEN :from AND :to', {
          from: `${year}-01-01`,
          to: `${year}-12-31`,
        }),
      't',
    )
      .groupBy('s.accountNumber')
      .getRawMany();
    const bankAccounts = sources
      .map(source => ({
        accountNumber: source.accountNumber,
        transactionCount: Number(source.count),
        account: settings.bankAccounts[source.accountNumber] ?? null,
      }))
      .sort((a, b) => b.transactionCount - a.transactionCount);
    if (counts.length === 0) {
      return { categories: [], bankAccounts };
    }
    const categories = await this.categoryRepository.find({
      where: { workspaceId, id: In(counts.map(row => row.categoryId)) },
    });
    const vatRegistered = workspace.vatStatus === VatStatus.REGISTERED;
    const rows = categories
      .map(category => {
        const concept = suggestedConcept(category.name, vatRegistered);
        return {
          categoryId: category.id,
          name: category.name,
          type: category.type,
          transactionCount: Number(counts.find(row => row.categoryId === category.id)?.count ?? 0),
          account: settings.accounts[category.id] ?? null,
          suggestion: concept
            ? {
                concept,
                account: accountFor(concept, settings.chart),
                name:
                  settings.chart === '03'
                    ? DATEV_CONCEPTS[concept].name03
                    : DATEV_CONCEPTS[concept].name04,
              }
            : null,
        };
      })
      .sort((a, b) => b.transactionCount - a.transactionCount);
    return { categories: rows, bankAccounts };
  }

  async preview(
    workspaceId: string,
    from: string,
    to: string,
    viewerMemberId: string | null,
  ): Promise<DatevPreview> {
    return (await this.build(workspaceId, from, to, viewerMemberId)).preview;
  }

  async exportFile(
    workspaceId: string,
    from: string,
    to: string,
    viewerMemberId: string | null,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const settings = await this.getSettings(workspaceId);
    const { bookings, preview } = await this.build(workspaceId, from, to, viewerMemberId);
    if (preview.missingSettings.length > 0) {
      throw new BadRequestException(
        'Enter the adviser number (Beraternummer) and client number (Mandantennummer) first',
      );
    }
    const content = datevFileContent(
      {
        createdAt: new Date(),
        consultantNumber: settings.consultantNumber as number,
        clientNumber: settings.clientNumber as number,
        fiscalYearStart: `${from.slice(0, 4)}-01-01`,
        accountLength: 4,
        from,
        to,
        label: `${APP_NAME} ${from} – ${to}`,
        chart: settings.chart,
      },
      bookings,
    );
    return {
      buffer: encodeWindows1252(content),
      fileName: `EXTF_Buchungsstapel_${from.replace(/-/g, '')}_${to.replace(/-/g, '')}.csv`,
    };
  }

  private async build(
    workspaceId: string,
    from: string,
    to: string,
    viewerMemberId: string | null,
  ): Promise<Built> {
    if (to < from) {
      throw new BadRequestException('The period must not end before it starts');
    }
    // One file stays within one fiscal year, which for an EÜR filer is the calendar year.
    if (from.slice(0, 4) !== to.slice(0, 4)) {
      throw new BadRequestException('A DATEV file covers one calendar year at most');
    }

    const [settings, workspace] = await Promise.all([
      this.getSettings(workspaceId),
      this.loadWorkspace(workspaceId),
    ]);
    const vatRegistered = workspace.vatStatus === VatStatus.REGISTERED;

    const rows = (
      await onlyCounted(
        this.transactionRepository
          .createQueryBuilder('t')
          .leftJoinAndSelect('t.category', 'c')
          .leftJoinAndSelect('t.taxRate', 'r')
          .leftJoinAndSelect('t.statement', 'st')
          .where('t.workspaceId = :workspaceId', { workspaceId })
          // A transfer between the business's own accounts is not a booking against a category.
          .andWhere('t.transferPairId IS NULL')
          .andWhere('t.transactionDate BETWEEN :from AND :to', { from, to }),
        't',
      )
        .orderBy('t.transactionDate', 'ASC')
        .addOrderBy('t.id', 'ASC')
        .getMany()
    ).filter(row => canReadPrivate(row, viewerMemberId));

    const bookings: DatevBooking[] = [];
    const unmapped = new Map<string, { categoryId: string; name: string; count: number }>();
    const issues: DatevIssue[] = [];
    let uncategorized = 0;
    let foreignCurrency = 0;
    let converted = 0;

    for (const row of rows) {
      const raw =
        row.amount ?? (row.transactionType === TransactionType.INCOME ? row.credit : row.debit);
      const originalMinor = Math.abs(toMinor(Number(raw ?? 0)));
      if (originalMinor === 0) {
        continue;
      }
      // The batch is in euros: a row in another currency is booked at the
      // euro value of its own day, and says what it was in the text.
      const currency = (row.currency || 'EUR').toUpperCase();
      const date = toDateOnly(row.transactionDate);
      let amountMinor = originalMinor;
      let suffix = '';
      if (currency !== 'EUR') {
        const rate = await this.exchangeRatesService.getRateOrNull(
          currency,
          'EUR',
          date,
          workspaceId,
        );
        if (rate === null) {
          foreignCurrency++;
          continue;
        }
        amountMinor = Math.round(originalMinor * rate);
        suffix = ` (${currency} ${(originalMinor / 100).toFixed(2)})`;
        converted++;
      }
      if (!row.categoryId) {
        uncategorized++;
        continue;
      }
      const contraAccount = settings.accounts[row.categoryId];
      if (!contraAccount) {
        const entry = unmapped.get(row.categoryId) ?? {
          categoryId: row.categoryId,
          name: row.category?.name ?? '—',
          count: 0,
        };
        entry.count++;
        unmapped.set(row.categoryId, entry);
        continue;
      }

      const isIncome = row.transactionType === TransactionType.INCOME;
      bookings.push({
        amountMinor,
        // The bank is debited when money comes in, credited when it goes out.
        side: isIncome ? 'S' : 'H',
        account: settings.bankAccounts[row.statement?.accountNumber ?? ''] ?? settings.bankAccount,
        contraAccount,
        taxKey: vatRegistered ? this.taxKey(row, settings.chart, contraAccount, issues) : null,
        date,
        documentNumber: row.documentNumber,
        text: `${(row.counterpartyName || row.paymentPurpose).slice(0, 60 - suffix.length)}${suffix}`,
      });
    }

    if (bookings.length > MAX_BOOKINGS) {
      throw new BadRequestException(
        `DATEV takes at most ${MAX_BOOKINGS} bookings per file; export a shorter period`,
      );
    }

    return {
      bookings,
      preview: {
        bookings: bookings.length,
        skipped: { uncategorized, unmapped: [...unmapped.values()], foreignCurrency },
        converted,
        issues,
        missingSettings: [
          ...(settings.consultantNumber === null ? (['consultantNumber'] as const) : []),
          ...(settings.clientNumber === null ? (['clientNumber'] as const) : []),
        ],
      },
    };
  }

  /**
   * The DATEV tax key (Steuerschlüssel, 2026 table) for a row's VAT: 401/402
   * input tax at 19/7 %, 101/102 output tax, 506/507 for an EU service the
   * buyer accounts for. An automatic account takes no key — DATEV books its
   * VAT itself — but if its rate is not the row's, the row is flagged.
   */
  private taxKey(
    row: Transaction,
    chart: DatevChart,
    contraAccount: string,
    issues: DatevIssue[],
  ): string | null {
    if (!row.taxRate || row.taxAmount === null) {
      return null;
    }
    const rate = Number(row.taxRate.rate);
    const automatic = automaticRate(chart, contraAccount);
    if (automatic !== null) {
      if (automatic !== rate && !row.taxReverseCharge) {
        issues.push({
          kind: 'automatic_rate_mismatch',
          transactionId: row.id,
          account: contraAccount,
          accountRate: automatic,
          rate,
        });
      }
      return null;
    }
    if (rate === 0) {
      return null;
    }
    const isIncome = row.transactionType === TransactionType.INCOME;
    if (row.taxReverseCharge) {
      if (!isIncome && (rate === 19 || rate === 7)) {
        return rate === 19 ? '506' : '507';
      }
      return null;
    }
    if (rate === 19) {
      return isIncome ? '101' : '401';
    }
    if (rate === 7) {
      return isIncome ? '102' : '402';
    }
    issues.push({ kind: 'unsupported_rate', transactionId: row.id, rate });
    return null;
  }

  private async loadWorkspace(workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });
    if (!workspace) {
      throw new BadRequestException('Workspace not found');
    }
    return workspace;
  }
}
