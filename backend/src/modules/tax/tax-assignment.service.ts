import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { fromMinor, toMinor } from '../../common/utils/money.util';
import { payeeKeyOf } from '../../common/utils/payee-key.util';
import { TaxRule, TaxRuleDirection } from '../../entities/tax-rule.entity';
import { TaxSource, Transaction, TransactionType } from '../../entities/transaction.entity';
import { VatStatus, Workspace } from '../../entities/workspace.entity';
import { findPayeeId } from '../payees/payee-resolution';
import { isEuCountry } from './eu-membership';
import { computeTax } from './tax-calculation';
import { taxPaymentsCategoryId } from './tax-payments-category';
import { TaxRatesService } from './tax-rates.service';

/**
 * Operation kinds that are outside the scope of VAT everywhere we support.
 *
 * Moving your own money between accounts is not a supply, wages are not a
 * supply, loan principal is not a supply, and paying tax is not itself a
 * taxable transaction. Assessing tax on any of these would inflate a return
 * with amounts that were never taxable.
 *
 * These values come from the AI classifier, which is why they are a safety net
 * and not the only guard — see `resolve` for the rest.
 */
const NON_TAXABLE_NATURES: ReadonlySet<string> = new Set(['transfer', 'salary', 'loan', 'tax']);

/**
 * Seeded system categories whose rows carry no VAT anywhere we tax: interest
 * is an exempt financial service (VAT Directive art. 135(1)(b)), and wages
 * and staff benefits are not a supply at all. Insurance (art. 135(1)(a)) is
 * handled beside it, since the UAE charges VAT on general insurance.
 */
const OUTSIDE_VAT_SYSTEM_CATEGORIES: ReadonlySet<string> = new Set([
  'Interest income',
  'Interest',
  'Payroll',
  'Benefits and compensation',
]);

export interface AssignmentInput {
  workspaceId: string;
  transactionDate: Date | string;
  /** Signed amount in minor units: negative for refunds and credit notes. */
  amountMinor: number;
  categoryId: string | null;
  transactionType: TransactionType;
  transactionNature: string | null;
  /** A rate the user chose explicitly, which always wins. */
  explicitTaxRateId?: string | null;
  /** ISO-3166-1 alpha-2 of the other party, when it is known. */
  counterpartyCountry?: string | null;
  /** Its presence is what makes the other party a business rather than a consumer. */
  counterpartyVatId?: string | null;
  /**
   * Who the row is with. When the row itself carries no country or VAT id,
   * the payee's are used: that is where the user records them once for every
   * purchase from the same supplier. Without an id, the payee is looked up
   * by the descriptor, as the payee subscriber would on insert.
   */
  payeeId?: string | null;
  counterpartyName?: string | null;
  paymentPurpose?: string | null;
}

/** Which unlocked rows `reassess` goes over. All of them when empty. */
export interface ReassessScope {
  ids?: string[];
  payeeId?: string;
  statementId?: string;
  /** 'YYYY-MM-DD': only rows dated on or after it. */
  from?: string;
}

const TAX_FIELDS = [
  'taxRateId',
  'taxRuleId',
  'taxSource',
  'taxAmount',
  'taxNetAmount',
  'taxReverseCharge',
  'taxNotionalAmount',
] as const;

/** Everything `resolve` needs, read off a stored transaction. */
export function assignmentInputOf(transaction: Transaction): AssignmentInput {
  const raw =
    transaction.amount ??
    (transaction.transactionType === TransactionType.INCOME
      ? transaction.credit
      : transaction.debit);
  return {
    workspaceId: transaction.workspaceId,
    transactionDate: transaction.transactionDate,
    amountMinor: toMinor(Number(raw ?? 0)),
    categoryId: transaction.categoryId,
    transactionType: transaction.transactionType,
    transactionNature: transaction.transactionNature ?? null,
    // A rate the user picked by hand is carried through; an automatic one is
    // derived again.
    explicitTaxRateId: transaction.taxSource === TaxSource.MANUAL ? transaction.taxRateId : null,
    counterpartyCountry: transaction.counterpartyCountry,
    counterpartyVatId: transaction.counterpartyVatId,
    payeeId: transaction.payeeId,
    counterpartyName: transaction.counterpartyName,
    paymentPurpose: transaction.paymentPurpose,
  };
}

/** Writes an assignment's figures onto a transaction. */
export function applyAssignment(transaction: Transaction, assignment: Assignment): void {
  for (const field of TAX_FIELDS) {
    (transaction as unknown as Record<string, unknown>)[field] = assignment[field];
  }
}

function sameFigure(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a ?? null) === (b ?? null);
  }
  return typeof a === 'boolean' || typeof b === 'boolean' ? a === b : Number(a) === Number(b);
}

/** Whether a stored row already carries exactly these figures. */
export function hasAssignment(transaction: Transaction, assignment: Assignment): boolean {
  return TAX_FIELDS.every(field =>
    field === 'taxRateId' || field === 'taxRuleId' || field === 'taxSource'
      ? (transaction[field] ?? null) === (assignment[field] ?? null)
      : sameFigure(transaction[field], assignment[field]),
  );
}

export interface Assignment {
  taxRateId: string | null;
  taxRuleId: string | null;
  taxSource: TaxSource | null;
  /** Major units, ready for the decimal columns. Null when nothing was assessed. */
  taxAmount: number | null;
  taxNetAmount: number | null;
  taxReverseCharge: boolean;
  /** What the tax would have been. Equal to taxAmount unless reverse-charged. */
  taxNotionalAmount: number | null;
}

const NOT_ASSESSED: Assignment = {
  taxRateId: null,
  taxRuleId: null,
  taxSource: null,
  taxAmount: null,
  taxNetAmount: null,
  taxReverseCharge: false,
  taxNotionalAmount: null,
};

/**
 * Decides which rate applies to a transaction, and computes the figures.
 *
 * The order is: an explicit choice, then a rule, then the workspace default.
 * Everything is resolved against the transaction's own date, never today —
 * resolving with today's date would retax a 2025 purchase at the 2026 rate the
 * moment the law changed.
 */
@Injectable()
export class TaxAssignmentService {
  private readonly logger = new Logger(TaxAssignmentService.name);

  constructor(
    @InjectRepository(TaxRule)
    private readonly taxRuleRepository: Repository<TaxRule>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly taxRatesService: TaxRatesService,
  ) {}

  /**
   * Whether the buyer, not the seller, accounts for the tax.
   *
   * All four conditions have to hold: both parties inside the EU, in different
   * member states, and the other party VAT-registered. A missing country or
   * VAT id therefore means "tax it normally" — the safe direction, since
   * charging tax that was not due is a correctable error, while omitting tax
   * that was due is an underpayment.
   */
  private isReverseCharged(
    home: { code: string; isEu: boolean } | null,
    counterpartyCountry: string | null | undefined,
    counterpartyVatId: string | null | undefined,
  ): boolean {
    if (!(counterpartyCountry && counterpartyVatId?.trim())) {
      return false;
    }

    if (!home?.isEu) {
      return false;
    }

    const other = counterpartyCountry.toUpperCase();
    // A domestic supply is charged normally however registered the buyer is.
    if (other === home.code.toUpperCase()) {
      return false;
    }

    return isEuCountry(other);
  }

  /**
   * The other party's country and VAT id: the row's own when it has them,
   * otherwise the payee's. Taken as a pair from one source, so a country from
   * the row is never combined with a VAT id from somewhere else.
   */
  private async counterpartyOf(
    input: AssignmentInput,
  ): Promise<{ country: string | null; vatId: string | null }> {
    if (input.counterpartyCountry || input.counterpartyVatId) {
      return {
        country: input.counterpartyCountry ?? null,
        vatId: input.counterpartyVatId ?? null,
      };
    }

    const manager = this.workspaceRepository.manager;
    let payeeId = input.payeeId ?? null;
    if (!payeeId) {
      const key = payeeKeyOf(input);
      payeeId = key ? await findPayeeId(manager, input.workspaceId, key) : null;
    }
    if (!payeeId) {
      return { country: null, vatId: null };
    }

    const [payee] = await manager.query(
      'SELECT country_code, vat_id, vat_id_status FROM payees WHERE id = $1 AND workspace_id = $2',
      [payeeId, input.workspaceId],
    );
    // A number VIES called invalid is no VAT registration; an unchecked one is taken as given.
    const vatId = payee?.vat_id_status === 'invalid' ? null : (payee?.vat_id ?? null);
    return { country: payee?.country_code ?? null, vatId };
  }

  async resolve(input: AssignmentInput): Promise<Assignment> {
    const {
      workspaceId,
      transactionDate,
      amountMinor,
      categoryId,
      transactionType,
      transactionNature,
      explicitTaxRateId,
    } = input;

    // 0. A workspace that does not charge VAT has none to assess — not even on
    //    a rate picked by hand, which it could neither charge nor reclaim.
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });
    if (!workspace || workspace.vatStatus !== VatStatus.REGISTERED) {
      return NOT_ASSESSED;
    }

    // Decided once, before any branch: a hand-picked rate on a cross-border
    // B2B supply is still reverse-charged. The guard inside short-circuits on
    // a missing country or VAT id.
    const counterparty = await this.counterpartyOf(input);
    const reverseCharged = this.isReverseCharged(
      workspace.taxJurisdiction ?? null,
      counterparty.country,
      counterparty.vatId,
    );

    // 1. An explicit choice is never second-guessed.
    if (explicitTaxRateId) {
      const rate = await this.taxRatesService
        .findOne(explicitTaxRateId, workspaceId)
        .catch(() => null);

      if (rate) {
        return this.assess(rate, null, TaxSource.MANUAL, amountMinor, reverseCharged);
      }
      // A rate that does not belong to this workspace is not a reason to fall
      // back to a different one and silently tax the row at the wrong rate.
      return NOT_ASSESSED;
    }

    // 2. Kinds of operation that are never a taxable supply.
    if (transactionNature && NON_TAXABLE_NATURES.has(transactionNature)) {
      return NOT_ASSESSED;
    }

    // 3. No category means the system does not know what this is. Applying the
    //    default rate here would quietly tax every unclassified transfer that
    //    the classifier failed to label.
    if (!categoryId) {
      return NOT_ASSESSED;
    }

    // 3b. Paying the tax office is not a purchase. Rows in the category the
    //     workspace books its tax payments to carry no VAT of their own.
    if (await this.isTaxPayment(workspaceId, categoryId)) {
      return NOT_ASSESSED;
    }

    // 4. The best matching rule.
    const rule = await this.findMatchingRule(workspaceId, categoryId, transactionType);
    if (rule) {
      const rate = await this.taxRatesService.findByCodeForDate(
        workspaceId,
        rule.taxRateCode,
        transactionDate,
      );

      if (rate) {
        return this.assess(rate, rule.id, TaxSource.RULE, amountMinor, reverseCharged);
      }

      // The rule names a code with no version in force on this date. Better to
      // leave the row unassessed and visible than to substitute another rate.
      this.logger.warn(
        `Tax rule ${rule.id} names code '${rule.taxRateCode}', which has no version ` +
          `in force on ${String(transactionDate)} for workspace ${workspaceId}`,
      );
      return NOT_ASSESSED;
    }

    // 4b. Kinds of spending and income outside VAT everywhere we tax: interest
    //     (exempt financial services), wages (not a supply) and, except in the
    //     UAE, insurance. Only the workspace default stops here — a rule the
    //     user wrote for the category was applied above.
    if (await this.isOutsideVat(workspaceId, categoryId, workspace.taxJurisdiction?.code ?? null)) {
      return NOT_ASSESSED;
    }

    // 5. The workspace default for that date.
    const fallback = await this.taxRatesService.findDefaultForDate(workspaceId, transactionDate);
    if (fallback) {
      return this.assess(fallback, null, TaxSource.DEFAULT, amountMinor, reverseCharged);
    }

    return NOT_ASSESSED;
  }

  /**
   * Assesses rows again under today's settings: VAT status, rates, rules and
   * the payee's country and VAT id. Rows in a filed return are never touched.
   * Only rows whose figures actually change are written, and they are written
   * with `update`, so nothing else about the row moves.
   *
   * Returns how many rows changed.
   */
  async reassess(workspaceId: string, scope: ReassessScope = {}): Promise<number> {
    const where = {
      workspaceId,
      taxLocked: false,
      ...(scope.ids ? { id: In(scope.ids) } : {}),
      ...(scope.payeeId ? { payeeId: scope.payeeId } : {}),
      ...(scope.statementId ? { statementId: scope.statementId } : {}),
      ...(scope.from ? { transactionDate: MoreThanOrEqual(scope.from as unknown as Date) } : {}),
    };
    if (scope.ids && scope.ids.length === 0) {
      return 0;
    }

    const BATCH = 500;
    let changed = 0;
    for (let skip = 0; ; skip += BATCH) {
      const rows = await this.transactionRepository.find({
        where,
        order: { id: 'ASC' },
        skip,
        take: BATCH,
      });
      for (const row of rows) {
        const assignment = await this.resolve(assignmentInputOf(row));
        if (hasAssignment(row, assignment)) {
          continue;
        }
        await this.transactionRepository.update(
          { id: row.id, workspaceId, taxLocked: false },
          {
            taxRateId: assignment.taxRateId,
            taxRuleId: assignment.taxRuleId,
            taxSource: assignment.taxSource,
            taxAmount: assignment.taxAmount,
            taxNetAmount: assignment.taxNetAmount,
            taxReverseCharge: assignment.taxReverseCharge,
            taxNotionalAmount: assignment.taxNotionalAmount,
          },
        );
        changed++;
      }
      if (rows.length < BATCH) {
        break;
      }
    }

    if (changed > 0) {
      this.logger.log(`Re-assessed ${changed} transactions in workspace ${workspaceId}`);
    }
    return changed;
  }

  /**
   * Whether a system category (or one under it) books something no VAT is
   * charged on. Matched by name, which is safe only because a system
   * category's name cannot be changed.
   */
  private async isOutsideVat(
    workspaceId: string,
    categoryId: string,
    jurisdictionCode: string | null,
  ): Promise<boolean> {
    const rows: Array<{ name: string; is_system: boolean }> =
      await this.workspaceRepository.manager.query(
        `SELECT c.name, c.is_system FROM categories c
        WHERE c.workspace_id = $2
          AND (c.id = $1 OR c.id = (SELECT parent_id FROM categories WHERE id = $1 AND workspace_id = $2))`,
        [categoryId, workspaceId],
      );
    return rows.some(
      row =>
        row.is_system &&
        (OUTSIDE_VAT_SYSTEM_CATEGORIES.has(row.name) ||
          (row.name === 'Insurance' && jurisdictionCode?.toUpperCase() !== 'AE')),
    );
  }

  private async isTaxPayment(workspaceId: string, categoryId: string): Promise<boolean> {
    const manager = this.workspaceRepository.manager;
    const paymentsCategoryId = await taxPaymentsCategoryId(manager, workspaceId);
    if (!paymentsCategoryId) {
      return false;
    }
    if (paymentsCategoryId === categoryId) {
      return true;
    }
    const [category] = await manager.query(
      'SELECT parent_id FROM categories WHERE id = $1 AND workspace_id = $2',
      [categoryId, workspaceId],
    );
    return category?.parent_id === paymentsCategoryId;
  }

  /**
   * Highest priority wins. A rule naming a category beats a catch-all at the
   * same priority, since it is the more specific statement of intent.
   */
  private async findMatchingRule(
    workspaceId: string,
    categoryId: string,
    transactionType: TransactionType,
  ): Promise<TaxRule | null> {
    const direction =
      transactionType === TransactionType.INCOME
        ? TaxRuleDirection.INCOME
        : TaxRuleDirection.EXPENSE;

    const rules = await this.taxRuleRepository.find({
      where: { workspaceId, isEnabled: true },
    });

    const matches = rules.filter(
      rule =>
        (rule.direction === TaxRuleDirection.BOTH || rule.direction === direction) &&
        (rule.categoryId === null || rule.categoryId === categoryId),
    );

    if (matches.length === 0) {
      return null;
    }

    matches.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      const aSpecific = a.categoryId === null ? 0 : 1;
      const bSpecific = b.categoryId === null ? 0 : 1;
      return bSpecific - aSpecific;
    });

    return matches[0];
  }

  private assess(
    rate: { id: string; rate: number | string; isInclusive: boolean; isReverseCharge: boolean },
    ruleId: string | null,
    source: TaxSource,
    amountMinor: number,
    autoReverseCharge = false,
  ): Assignment {
    // Either the rate is itself a reverse-charge rate, or the counterparty
    // makes this supply one.
    const isReverseCharge = rate.isReverseCharge || autoReverseCharge;

    const breakdown = computeTax({
      amountMinor,
      rate: Number(rate.rate),
      isInclusive: rate.isInclusive,
      isReverseCharge,
    });

    return {
      taxRateId: rate.id,
      taxRuleId: ruleId,
      taxSource: source,
      taxAmount: fromMinor(breakdown.taxMinor),
      taxNetAmount: fromMinor(breakdown.netMinor),
      taxReverseCharge: isReverseCharge,
      taxNotionalAmount: fromMinor(breakdown.notionalTaxMinor),
    };
  }
}

/** Convenience for callers holding a major-unit amount. */
export function amountToMinor(amount: number | string | null): number {
  return amount === null ? 0 : toMinor(amount);
}
