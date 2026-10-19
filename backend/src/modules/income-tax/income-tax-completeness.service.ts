import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, type Repository } from 'typeorm';
import { Receipt, ReceiptStatus } from '../../entities/receipt.entity';
import { Statement, StatementStatus } from '../../entities/statement.entity';
import type { CompletenessIssue, CompletenessReport, DraftSignals } from './income-tax.types';

const DAY_MS = 86_400_000;
const STALE_UPLOAD_DAYS = 14;
const REGULAR_TRACKING_RATIO = 0.5;

export function taxYearBounds(taxYear: number): { yearStart: string; yearEnd: string } {
  return { yearStart: `${taxYear}-01-01`, yearEnd: `${taxYear}-12-31` };
}

interface StatementPeriod {
  accountNumber: string | null;
  statementDateFrom: Date | string | null;
  statementDateTo: Date | string | null;
}

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function maskAccount(account: string): string {
  return `•••• ${account.replace(/\s/g, '').slice(-4)}`;
}

/**
 * Months of the year with no statement for an account, per account.
 *
 * A month counts as covered when any statement touches it; the check is meant
 * to catch a forgotten upload, not to audit day-level overlap. Months before an
 * account's first statement in the year are not reported — the account may
 * simply not have existed yet. The current month is never reported, because
 * its statement cannot exist yet.
 */
export function findCoverageGaps(
  statements: StatementPeriod[],
  taxYear: number,
  now: Date,
): Array<{ account: string; months: number[] }> {
  const currentYear = now.getUTCFullYear();
  const lastMonth = taxYear < currentYear ? 12 : taxYear === currentYear ? now.getUTCMonth() : 0;
  if (lastMonth === 0) {
    return [];
  }

  const coveredByAccount = new Map<string, Set<number>>();
  for (const statement of statements) {
    if (!(statement.accountNumber && statement.statementDateFrom && statement.statementDateTo)) {
      continue;
    }
    const from = isoDate(statement.statementDateFrom);
    const to = isoDate(statement.statementDateTo);
    const { yearStart, yearEnd } = taxYearBounds(taxYear);
    const start = from < yearStart ? yearStart : from;
    const end = to > yearEnd ? yearEnd : to;
    if (start > end) {
      continue;
    }

    const covered = coveredByAccount.get(statement.accountNumber) ?? new Set<number>();
    for (let month = Number(start.slice(5, 7)); month <= Number(end.slice(5, 7)); month++) {
      covered.add(month);
    }
    coveredByAccount.set(statement.accountNumber, covered);
  }

  const gaps: Array<{ account: string; months: number[] }> = [];
  for (const [account, covered] of coveredByAccount) {
    const firstMonth = Math.min(...covered);
    const months: number[] = [];
    for (let month = firstMonth; month <= lastMonth; month++) {
      if (!covered.has(month)) {
        months.push(month);
      }
    }
    if (months.length > 0) {
      gaps.push({ account: maskAccount(account), months });
    }
  }
  return gaps;
}

export interface ScoreInput {
  signals: DraftSignals;
  coverageGaps: Array<{ account: string; months: number[] }>;
  statementsWithErrors: number;
  statementsPendingReview: number;
  receiptsPendingReview: number;
  activeDaysRatio: number | null;
  daysSinceLastUpload: number | null;
  isCurrentYear: boolean;
}

/**
 * Turns the signals into a 0–100 score and a list of things to fix.
 *
 * The weights are a judgement, not a measurement: they rank what distorts a
 * declaration most. Unmapped categories and missing exchange rates weigh
 * heavily because those transactions are left out of the figures entirely;
 * uncategorised ones are excluded too, but are usually small.
 */
export function scoreCompleteness(input: ScoreInput): Pick<CompletenessReport, 'score' | 'issues'> {
  const { signals } = input;
  const issues: CompletenessIssue[] = [];
  let score = 100;
  const total = signals.transactionCount;
  const share = (count: number) => (total > 0 ? count / total : 0);

  if (total === 0) {
    issues.push({ code: 'no_transactions', severity: 'critical', count: 0 });
    score -= 60;
  }

  if (signals.uncategorizedCount > 0) {
    const ratio = share(signals.uncategorizedCount);
    issues.push({
      code: 'uncategorized_transactions',
      severity: ratio > 0.1 ? 'critical' : 'warning',
      count: signals.uncategorizedCount,
    });
    score -= 30 * ratio;
  }

  if (signals.unmappedTransactionCount > 0) {
    issues.push({
      code: 'unmapped_categories',
      severity: 'critical',
      count: signals.unmappedTransactionCount,
      params: { categories: signals.unmappedCategories },
    });
    score -= 25 * share(signals.unmappedTransactionCount);
  }

  if (signals.missingFxCount > 0) {
    issues.push({
      code: 'missing_exchange_rates',
      severity: 'critical',
      count: signals.missingFxCount,
      params: { currencies: signals.missingFxCurrencies },
    });
    score -= Math.max(5, 15 * share(signals.missingFxCount));
  }

  const gapMonths = input.coverageGaps.reduce((sum, gap) => sum + gap.months.length, 0);
  if (gapMonths > 0) {
    issues.push({
      code: 'statement_coverage_gaps',
      severity: 'warning',
      count: gapMonths,
      params: { accounts: input.coverageGaps },
    });
    score -= Math.min(20, 5 * gapMonths);
  }

  if (input.statementsWithErrors > 0) {
    issues.push({
      code: 'statements_with_errors',
      severity: 'critical',
      count: input.statementsWithErrors,
    });
  }
  if (input.statementsPendingReview > 0) {
    issues.push({
      code: 'statements_pending_review',
      severity: 'warning',
      count: input.statementsPendingReview,
    });
  }
  score -= Math.min(10, 5 * (input.statementsWithErrors + input.statementsPendingReview));

  if (input.receiptsPendingReview > 0) {
    issues.push({
      code: 'receipts_pending_review',
      severity: 'info',
      count: input.receiptsPendingReview,
    });
    score -= Math.min(5, input.receiptsPendingReview);
  }

  if (
    input.isCurrentYear &&
    input.daysSinceLastUpload !== null &&
    input.daysSinceLastUpload > STALE_UPLOAD_DAYS
  ) {
    issues.push({
      code: 'stale_upload',
      severity: 'warning',
      count: input.daysSinceLastUpload,
    });
    score -= 5;
  }

  if (input.activeDaysRatio !== null && input.activeDaysRatio < REGULAR_TRACKING_RATIO) {
    issues.push({
      code: 'irregular_tracking',
      severity: 'warning',
      count: Math.round(input.activeDaysRatio * 100),
      params: { ratio: input.activeDaysRatio },
    });
    score -= (REGULAR_TRACKING_RATIO - input.activeDaysRatio) * 20;
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), issues };
}

/**
 * How far the year's data can be trusted for a declaration.
 *
 * This is what backs the disclaimer with numbers: the draft is only as good as
 * the discipline behind it, so the signals below are about what is missing or
 * unreviewed, and about how regularly anything was recorded at all.
 */
@Injectable()
export class IncomeTaxCompletenessService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
  ) {}

  async check(
    workspaceId: string,
    taxYear: number,
    signals: DraftSignals,
    now: Date = new Date(),
  ): Promise<CompletenessReport> {
    const { yearStart, yearEnd } = taxYearBounds(taxYear);

    const [statements, receiptsPendingReview, latestStatement, activeDays] = await Promise.all([
      this.statementRepository
        .createQueryBuilder('s')
        .select(['s.id', 's.status', 's.accountNumber', 's.statementDateFrom', 's.statementDateTo'])
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.deletedAt IS NULL')
        .andWhere(
          `((s.statementDateFrom IS NOT NULL AND s.statementDateTo IS NOT NULL
              AND s.statementDateFrom <= :yearEnd AND s.statementDateTo >= :yearStart)
            OR ((s.statementDateFrom IS NULL OR s.statementDateTo IS NULL)
              AND s.createdAt >= :yearStart AND s.createdAt < :nextYearStart))`,
          { yearStart, yearEnd, nextYearStart: `${taxYear + 1}-01-01` },
        )
        .getMany(),
      this.receiptRepository.count({
        where: {
          workspaceId,
          status: In([ReceiptStatus.NEW, ReceiptStatus.NEEDS_REVIEW]),
          receivedAt: Between(new Date(`${yearStart}T00:00:00Z`), new Date(`${yearEnd}T23:59:59Z`)),
        },
      }),
      this.statementRepository.findOne({
        where: { workspaceId, deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
        select: ['id', 'createdAt'],
      }),
      this.countActiveDays(workspaceId, taxYear, now),
    ]);

    const statementsWithErrors = statements.filter(s => s.status === StatementStatus.ERROR).length;
    const statementsPendingReview = statements.filter(s =>
      [StatementStatus.UPLOADED, StatementStatus.PARSED, StatementStatus.VALIDATED].includes(
        s.status,
      ),
    ).length;
    const coverageGaps = findCoverageGaps(
      statements.filter(s => s.status !== StatementStatus.ERROR),
      taxYear,
      now,
    );
    const daysSinceLastUpload = latestStatement
      ? Math.floor((now.getTime() - new Date(latestStatement.createdAt).getTime()) / DAY_MS)
      : null;

    const { score, issues } = scoreCompleteness({
      signals,
      coverageGaps,
      statementsWithErrors,
      statementsPendingReview,
      receiptsPendingReview,
      activeDaysRatio: activeDays,
      daysSinceLastUpload,
      isCurrentYear: taxYear === now.getUTCFullYear(),
    });

    return { score, issues, activeDaysRatio: activeDays, daysSinceLastUpload };
  }

  /**
   * Share of the year's elapsed days on which someone recorded anything: a
   * user action in the audit log, or a transaction created. A year imported in
   * one go in March scores low here on purpose — that is exactly the usage the
   * disclaimer warns about.
   */
  private async countActiveDays(
    workspaceId: string,
    taxYear: number,
    now: Date,
  ): Promise<number | null> {
    const start = Date.UTC(taxYear, 0, 1);
    const end = Math.min(now.getTime(), Date.UTC(taxYear + 1, 0, 1));
    if (end <= start) {
      return null;
    }
    const elapsedDays = Math.ceil((end - start) / DAY_MS);

    const rows: Array<{ days: number }> = await this.statementRepository.query(
      `SELECT COUNT(*)::int AS days FROM (
         SELECT created_at::date AS day FROM audit_events
          WHERE workspace_id = $1 AND actor_type = 'user' AND created_at >= $2 AND created_at < $3
         UNION
         SELECT created_at::date FROM transactions
          WHERE workspace_id = $1 AND created_at >= $2 AND created_at < $3
       ) active`,
      [workspaceId, new Date(start), new Date(end)],
    );

    const days = Number(rows[0]?.days ?? 0);
    return Math.min(1, Math.round((days / elapsedDays) * 100) / 100);
  }
}
