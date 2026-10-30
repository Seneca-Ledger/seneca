import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, type Repository } from 'typeorm';
import { Transaction } from '../../entities';
import { ImportConfigService } from '../import/config/import.config';
import type { ParsedTransaction } from '../parsing/interfaces/parsed-statement.interface';
import { IntelligentDeduplicationService } from '../parsing/services/intelligent-deduplication.service';
import type { BankSyncAccountSetting } from './bank-sync.config';
import { DAY_MS } from './bank-sync-health';
import { providerRowKey } from './bank-sync-ofx.util';
import type { BankSyncTransaction } from './bank-sync-provider.interface';

/**
 * Postgres hands back `date` columns as strings and `decimal` columns as
 * strings, so a stored row has to be coerced before it can be compared with a
 * freshly parsed one. Skipping this is a silent failure: the comparison throws
 * on the date, or quietly scores every amount as different.
 */
function asComparable(row: Transaction): ParsedTransaction {
  const toNumber = (value: number | string | null): number | undefined => {
    if (value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  return {
    transactionDate: new Date(row.transactionDate),
    counterpartyName: row.counterpartyName ?? '',
    paymentPurpose: row.paymentPurpose ?? '',
    debit: toNumber(row.debit),
    credit: toNumber(row.credit),
    currency: row.currency,
  };
}

/** The provider's row in the shape the tolerant comparison expects. */
function asParsedTransaction(row: BankSyncTransaction, currency: string): ParsedTransaction {
  const name = row.payee || row.description || row.memo || '';
  return {
    transactionDate: row.posted,
    counterpartyName: name,
    paymentPurpose: row.memo || row.description || name,
    debit: row.amount < 0 ? Math.abs(row.amount) : undefined,
    credit: row.amount >= 0 ? row.amount : undefined,
    currency,
  };
}

/**
 * Drops pulled rows the workspace already holds, in two passes.
 *
 * The provider's own id catches a re-pull of the same feed. It does not catch
 * the two cases that actually corrupt data: a feed moved to another provider,
 * which numbers the same purchase differently, and a bank that renumbers a
 * row when it moves from pending to booked. Those need the same tolerant
 * comparison a re-uploaded statement gets, so this reuses it rather than
 * inventing a second notion of "same transaction".
 */
@Injectable()
export class BankSyncDedupeService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly deduplication: IntelligentDeduplicationService,
    private readonly importConfig: ImportConfigService,
  ) {}

  async withoutKnownRows(
    workspaceId: string,
    account: BankSyncAccountSetting,
    rows: BankSyncTransaction[],
    currency: string,
  ): Promise<BankSyncTransaction[]> {
    if (rows.length === 0) return rows;
    const byId = await this.withoutKnownIds(workspaceId, account.id, rows);
    // Without a wallet there is nothing to scope the comparison to, and matching
    // across the whole workspace would drop honest look-alikes from other accounts.
    if (byId.length === 0 || !account.walletId) return byId;
    return this.withoutTolerantMatches(workspaceId, account.walletId, byId, currency);
  }

  private async withoutKnownIds(
    workspaceId: string,
    accountId: string,
    rows: BankSyncTransaction[],
  ): Promise<BankSyncTransaction[]> {
    const known = new Set<string>();
    const ids = rows.map(row => providerRowKey(accountId, row.id));
    for (let offset = 0; offset < ids.length; offset += 500) {
      const existing = await this.transactionRepository.find({
        where: { workspaceId, documentNumber: In(ids.slice(offset, offset + 500)) },
        select: { documentNumber: true },
      });
      for (const row of existing) {
        if (row.documentNumber) known.add(row.documentNumber);
      }
    }
    return rows.filter(row => !known.has(providerRowKey(accountId, row.id)));
  }

  private async withoutTolerantMatches(
    workspaceId: string,
    walletId: string,
    rows: BankSyncTransaction[],
    currency: string,
  ): Promise<BankSyncTransaction[]> {
    const tolerance = this.importConfig.getDedupDateToleranceDays();
    const times = rows.map(row => row.posted.getTime());
    const from = new Date(Math.min(...times) - tolerance * DAY_MS);
    const to = new Date(Math.max(...times) + tolerance * DAY_MS);
    const existing = await this.transactionRepository.find({
      where: { workspaceId, walletId, transactionDate: Between(from, to) },
    });
    if (existing.length === 0) return rows;
    const stored = existing.map(row => ({ id: row.id, parsed: asComparable(row) }));

    const claimed = new Set<string>();
    return rows.filter(row => {
      const parsed = asParsedTransaction(row, currency);
      const match = stored.find(candidate => {
        if (claimed.has(candidate.id)) return false;
        return this.deduplication.applyTolerantRules(parsed, candidate.parsed).isMatch;
      });
      if (!match) return true;
      // One stored row can only account for one incoming row.
      claimed.add(match.id);
      return false;
    });
  }
}
