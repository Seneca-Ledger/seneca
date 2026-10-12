import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { Transaction } from '../../entities/transaction.entity';
import { toDateOnly } from './jurisdictions.service';
import { applyAssignment, assignmentInputOf, TaxAssignmentService } from './tax-assignment.service';

/** What the tax on a row depends on. */
const TAX_INPUTS = [
  'categoryId',
  'amount',
  'debit',
  'credit',
  'transactionDate',
  'transactionType',
  'transactionNature',
  'counterpartyCountry',
  'counterpartyVatId',
  'payeeId',
] as const satisfies ReadonlyArray<keyof Transaction>;

/** Tax figures a caller may have set itself in the same write (a split does). */
const TAX_OUTPUTS = ['taxRateId', 'taxAmount', 'taxSource'] as const;

function comparable(value: unknown): unknown {
  if (value instanceof Date) {
    return toDateOnly(value);
  }
  if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))) {
    return Number(value);
  }
  return value ?? null;
}

function changed(entity: Transaction, before: Transaction, field: keyof Transaction): boolean {
  const next = entity[field];
  return next !== undefined && comparable(next) !== comparable(before[field]);
}

/**
 * Assesses tax again whenever a saved edit changes what the tax depends on:
 * the category, the amount, the date, the other party. Without it, moving a
 * row from "Groceries" to "Office supplies" kept the rate of the old category,
 * and the return carried the stale figure.
 *
 * Only `save()` reaches a subscriber; paths that write with `update()` call
 * `TaxAssignmentService.reassess` themselves. Rows in a filed return are left
 * alone — the edit guard refuses those changes before they get here.
 */
@Injectable()
export class TransactionTaxSubscriber implements EntitySubscriberInterface<Transaction> {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly taxAssignmentService: TaxAssignmentService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Transaction;
  }

  async beforeUpdate(event: UpdateEvent<Transaction>): Promise<void> {
    const entity = event.entity as Transaction | undefined;
    const before = event.databaseEntity;
    if (!(entity?.workspaceId && before) || before.taxLocked || entity.taxLocked) {
      return;
    }
    if (!TAX_INPUTS.some(field => changed(entity, before, field))) {
      return;
    }
    if (TAX_OUTPUTS.some(field => changed(entity, before, field))) {
      return;
    }

    const merged = { ...before } as Transaction;
    for (const [field, value] of Object.entries(entity)) {
      if (value !== undefined) {
        (merged as unknown as Record<string, unknown>)[field] = value;
      }
    }
    applyAssignment(entity, await this.taxAssignmentService.resolve(assignmentInputOf(merged)));
  }
}
