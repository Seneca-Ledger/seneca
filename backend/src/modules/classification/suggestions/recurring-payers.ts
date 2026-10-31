import type { Repository } from 'typeorm';
import type { Transaction } from '../../../entities/transaction.entity';
import { detectRecurringIncome } from '../../forecast/forecast.engine';
import { looksLikePerson } from './person-name';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far back a statement's payers are looked for: three or four paydays. */
const LOOKBACK_DAYS = 120;

const dayOf = (value: Date | string): string => new Date(value).toISOString().slice(0, 10);

/**
 * Payers that pay this workspace regularly, much the same amount every week
 * to month (the forecast's payday detector), and are a business rather than a
 * person: their money is most likely a salary. A parent or a tenant paying
 * regularly is a person and is not here. Judged as of the statement's last
 * day, so an old statement is read as it was then. Lower-cased names.
 */
export async function recurringBusinessPayers(
  transactions: Repository<Transaction>,
  workspaceId: string,
  rows: Transaction[],
): Promise<Set<string>> {
  const income = rows.filter(row => row.transactionType === 'income');
  if (income.length === 0) {
    return new Set();
  }
  const times = income.map(row => new Date(row.transactionDate).getTime());
  const asOf = dayOf(new Date(Math.max(...times)));
  const since = dayOf(new Date(Math.min(...times) - LOOKBACK_DAYS * DAY_MS));
  const history = await transactions
    .createQueryBuilder('t')
    .select(['t.counterpartyName', 't.amount', 't.credit', 't.transactionDate'])
    .where('t.workspaceId = :workspaceId', { workspaceId })
    .andWhere("t.transactionType = 'income'")
    .andWhere('t.isDuplicate = false')
    .andWhere('t.transferPairId IS NULL')
    .andWhere('t.transactionDate BETWEEN :since AND :asOf', { since, asOf })
    .getMany();
  const paydays = detectRecurringIncome(
    history.map(row => ({
      counterpartyName: row.counterpartyName,
      amount: Math.abs(Number(row.amount) || Number(row.credit) || 0),
      transactionDate: row.transactionDate,
    })),
    asOf,
  );
  return new Set(
    paydays
      .map(payday => payday.label)
      .filter(label => label && !looksLikePerson(label))
      .map(label => label.toLowerCase()),
  );
}
