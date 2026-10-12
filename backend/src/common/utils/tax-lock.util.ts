import { ConflictException } from '@nestjs/common';
import type { FindOptionsWhere, Repository } from 'typeorm';
import type { Transaction } from '../../entities/transaction.entity';
import { appError } from '../errors/app-error';

export const TAX_LOCKED_ERROR_CODE = 'TAX_LOCKED' as const;

/**
 * Refuses to delete rows that are part of a filed tax return.
 *
 * A filed return was built from these rows and submitted to a tax authority.
 * Deleting one leaves the books disagreeing with what was filed, and the
 * deletion would be invisible in the return itself. The return has to be
 * reopened first — a deliberate, audited step.
 */
export async function assertNoTaxLockedTransactions(
  repository: Repository<Transaction>,
  where: FindOptionsWhere<Transaction>,
): Promise<void> {
  const locked = await repository.count({ where: { ...where, taxLocked: true } });
  if (locked > 0) {
    throw taxLockedConflict(locked);
  }
}

/** The refusal itself, for callers that already hold the rows. */
export function taxLockedConflict(locked: number): ConflictException {
  return new ConflictException(appError(TAX_LOCKED_ERROR_CODE, { count: locked }));
}
