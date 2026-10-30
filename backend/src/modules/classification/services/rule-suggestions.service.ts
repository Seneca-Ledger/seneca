import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { canReadPrivate } from '../../../common/utils/transaction-privacy.util';
import { CategorizationRule } from '../../../entities/categorization-rule.entity';
import { Payee, PayeeMode } from '../../../entities/payee.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { decidePayeeCategory } from '../engine/payee-category.matcher';
import { onlyPayeeEvidence } from '../engine/payee-evidence';
import { matchesConditions } from '../engine/rule-conditions';
import type { ClassificationCondition } from '../interfaces/classification-rule.interface';

/** How many decided rows of a payee, under one category, make it worth a rule. */
const MIN_DECIDED = 3;
/** How many of the newest decided rows are read to find candidates. */
const EVIDENCE_LIMIT = 5000;
const MAX_SUGGESTIONS = 10;
/** As the payee history reads it: a longer tail would let old habits outvote new ones. */
const HISTORY_DEPTH = 12;

export type RuleSuggestion = {
  payeeId: string;
  payeeName: string;
  categoryId: string;
  decidedCount: number;
  conditions: ClassificationCondition[];
};

/**
 * The condition that catches every one of these rows by their bank text: the
 * payee's name when each descriptor contains it, else the one descriptor they
 * all share. Neither holds: no suggestion, rather than a rule that misses.
 */
function conditionFor(payee: Payee, rows: readonly Transaction[]): ClassificationCondition | null {
  const candidates: ClassificationCondition[] = [
    { field: 'counterparty_name', operator: 'contains', value: payee.name.trim() },
  ];
  const names = new Map<string, number>();
  for (const row of rows) {
    names.set(row.counterpartyName, (names.get(row.counterpartyName) ?? 0) + 1);
  }
  const [common] = [...names.entries()].sort((a, b) => b[1] - a[1]);
  if (common) {
    candidates.push({ field: 'counterparty_name', operator: 'equals', value: common[0] });
  }
  return (
    candidates.find(
      condition =>
        String(condition.value).length > 0 &&
        rows.every(row => matchesConditions(row, [condition])),
    ) ?? null
  );
}

/**
 * Rules worth writing, read off what people already decide by hand: a payee
 * filed under the same category again and again. It is the same evidence the
 * payee history learns from (`onlyPayeeEvidence`); a rule still adds that its
 * category counts as decided, that it works on bank text before the payee is
 * known, and that it can tag the row too. A payee pinned or muted on the
 * Payees page is left there, and one an active rule already catches is not
 * offered again.
 */
@Injectable()
export class RuleSuggestionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Payee)
    private readonly payeeRepository: Repository<Payee>,
    @InjectRepository(CategorizationRule)
    private readonly ruleRepository: Repository<CategorizationRule>,
  ) {}

  async suggest(workspaceId: string, viewerMemberId: string | null): Promise<RuleSuggestion[]> {
    const evidence = await onlyPayeeEvidence(
      this.transactionRepository
        .createQueryBuilder('transaction')
        .where('transaction.workspaceId = :workspaceId', { workspaceId })
        .andWhere('transaction.payeeId IS NOT NULL'),
      'transaction',
    )
      .orderBy('transaction.transactionDate', 'DESC')
      .addOrderBy('transaction.createdAt', 'DESC')
      .take(EVIDENCE_LIMIT)
      .getMany();

    // Newest first per payee; another member's private row teaches nothing here.
    const byPayee = new Map<string, Transaction[]>();
    for (const row of evidence) {
      if (!canReadPrivate(row, viewerMemberId)) {
        continue;
      }
      const rows = byPayee.get(row.payeeId as string) ?? [];
      rows.push(row);
      byPayee.set(row.payeeId as string, rows);
    }

    const candidates = [...byPayee.entries()].flatMap(([payeeId, rows]) => {
      const decision = decidePayeeCategory({
        history: rows
          .slice(0, HISTORY_DEPTH)
          .reverse()
          .map(row => ({ categoryId: row.categoryId as string })),
      });
      const filed = decision ? rows.filter(row => row.categoryId === decision.categoryId) : [];
      return decision && filed.length >= MIN_DECIDED
        ? [{ payeeId, categoryId: decision.categoryId, rows: filed }]
        : [];
    });
    if (candidates.length === 0) {
      return [];
    }

    const [payees, rules] = await Promise.all([
      this.payeeRepository.find({
        where: { id: In(candidates.map(candidate => candidate.payeeId)), workspaceId },
      }),
      this.ruleRepository.find({ where: { workspaceId, isActive: true } }),
    ]);
    const payeeById = new Map(payees.map(payee => [payee.id, payee]));

    const suggestions: RuleSuggestion[] = [];
    for (const candidate of candidates.sort((a, b) => b.rows.length - a.rows.length)) {
      const payee = payeeById.get(candidate.payeeId);
      if (!payee || payee.mode !== PayeeMode.AUTO) {
        continue;
      }
      if (rules.some(rule => matchesConditions(candidate.rows[0], rule.conditions))) {
        continue;
      }
      const condition = conditionFor(payee, candidate.rows);
      if (!condition) {
        continue;
      }
      suggestions.push({
        payeeId: payee.id,
        payeeName: payee.name,
        categoryId: candidate.categoryId,
        decidedCount: candidate.rows.length,
        conditions: [condition],
      });
      if (suggestions.length === MAX_SUGGESTIONS) {
        break;
      }
    }
    return suggestions;
  }
}
