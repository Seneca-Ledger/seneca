import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { PayablePayment } from '../../entities/payable-payment.entity';

/** A bank row may post up to a week either side of the day a payment was marked. */
const DAYS_APART = 7;

interface Candidate {
  payment_id: string;
  payable_id: string;
  transaction_id: string;
}

/**
 * Payments recorded without a transaction: "marked received" (or paid) with
 * neither a wallet nor a bank row. No transaction was booked on purpose — the
 * money comes in with the bank statement, and booking it twice would count it
 * twice — so until then the payment is not in any account and no figure shows
 * it. This links such a payment to the row of the same money once that row
 * exists, and says per bill how much is still not in an account.
 */
@Injectable()
export class UnbookedPaymentsService {
  constructor(
    @InjectRepository(PayablePayment)
    private readonly paymentRepository: Repository<PayablePayment>,
  ) {}

  /**
   * Links every unbooked payment of the workspace to a row of the same money:
   * same currency, income for a receivable and spending for a bill, the amount
   * the account received (the payment less the processor's fee), at most a
   * week apart, and not already the payment of a bill. One row per payment,
   * the closest date first. Returns how many it linked.
   */
  async linkUnbooked(workspaceId: string, manager?: EntityManager): Promise<number> {
    const run = manager ?? this.paymentRepository.manager;
    const candidates: Candidate[] = await run.query(
      `
      SELECT pp.id AS payment_id, pp.payable_id, t.id AS transaction_id
      FROM payable_payments pp
      JOIN payables p ON p.id = pp.payable_id AND p.deleted_at IS NULL
      JOIN transactions t
        ON t.workspace_id = pp.workspace_id
       AND UPPER(t.currency) = UPPER(p.currency)
       AND (
         (p.direction = 'receivable' AND t.transaction_type = 'income'
            AND t.credit = pp.amount - pp.fee_amount)
         OR (p.direction = 'payable' AND t.transaction_type = 'expense'
            AND t.debit = pp.amount - pp.fee_amount)
       )
       AND ABS(t.transaction_date - pp.paid_on) <= ${DAYS_APART}
       AND t.is_duplicate = false
       AND t.transfer_pair_id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM statements trashed
         WHERE trashed.id = t.statement_id AND trashed.deleted_at IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM payable_payments used WHERE used.transaction_id = t.id)
       AND NOT EXISTS (
         SELECT 1 FROM payables used_by
         WHERE used_by.linked_transaction_id = t.id AND used_by.deleted_at IS NULL)
      WHERE pp.workspace_id = $1 AND pp.transaction_id IS NULL
      ORDER BY ABS(t.transaction_date - pp.paid_on), pp.paid_on, pp.id, t.created_at, t.id
      `,
      [workspaceId],
    );

    const takenPayments = new Set<string>();
    const takenRows = new Set<string>();
    let linked = 0;
    for (const candidate of candidates) {
      if (takenPayments.has(candidate.payment_id) || takenRows.has(candidate.transaction_id)) {
        continue;
      }
      takenPayments.add(candidate.payment_id);
      takenRows.add(candidate.transaction_id);
      await run.query(
        'UPDATE payable_payments SET transaction_id = $2 WHERE id = $1 AND transaction_id IS NULL',
        [candidate.payment_id, candidate.transaction_id],
      );
      // The bill points at its payment too, unless an earlier one already does.
      await run.query(
        `UPDATE payables SET linked_transaction_id = $2
         WHERE id = $1 AND linked_transaction_id IS NULL`,
        [candidate.payable_id, candidate.transaction_id],
      );
      linked++;
    }
    return linked;
  }

  /**
   * How much each bill has been paid without the money being in an account:
   * what it says was received less the payments linked to a transaction. A bill
   * linked to a transaction before payments were recorded counts as booked; one
   * set paid by hand with no payment at all is wholly unbooked.
   */
  async unbookedByPayable(
    workspaceId: string,
    payableIds?: string[],
  ): Promise<Map<string, number>> {
    if (payableIds && payableIds.length === 0) {
      return new Map();
    }
    const rows: Array<{ id: string; unbooked: string }> =
      await this.paymentRepository.manager.query(
        `
      SELECT p.id,
        GREATEST(
          received.amount
          - COALESCE((
              SELECT SUM(pp.amount) FROM payable_payments pp
              WHERE pp.payable_id = p.id AND pp.transaction_id IS NOT NULL), 0)
          - CASE
              WHEN p.linked_transaction_id IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM payable_payments any_pp WHERE any_pp.payable_id = p.id)
              THEN received.amount ELSE 0
            END,
          0) AS unbooked
      FROM payables p
      CROSS JOIN LATERAL (
        SELECT CASE WHEN p.status = 'paid' THEN p.amount ELSE LEAST(p.paid_amount, p.amount) END AS amount
      ) received
      WHERE p.workspace_id = $1 AND p.deleted_at IS NULL AND p.status <> 'archived'
        AND ($2::uuid[] IS NULL OR p.id = ANY($2::uuid[]))
      `,
        [workspaceId, payableIds ?? null],
      );
    return new Map(rows.map(row => [row.id, Number(row.unbooked)]));
  }
}
