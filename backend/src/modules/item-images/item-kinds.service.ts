import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { canReadPrivate } from '../../common/utils/transaction-privacy.util';
import type { ItemKind } from '../../contracts';
import { Payable, Transaction } from '../../entities';
import { itemKindMatcher } from './item-kind.matcher';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 200;
const ids = (raw: readonly string[]): string[] =>
  [...new Set(raw.filter(id => UUID.test(id)))].slice(0, MAX_IDS);

/**
 * The kind of thing each row names ("Sold Mac Mini M4" → desktop), for the
 * line icon a list draws until someone picks a picture. Matched here rather
 * than in the browser: the dictionary is too large to send.
 */
@Injectable()
export class ItemKindsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(Payable)
    private readonly payables: Repository<Payable>,
  ) {}

  /** Someone else's private row names nothing. */
  async forTransactions(
    workspaceId: string,
    rawIds: readonly string[],
    viewerMemberId: string | null,
  ): Promise<ItemKind[]> {
    const wanted = ids(rawIds);
    if (wanted.length === 0) {
      return [];
    }
    const rows = await this.transactions.find({
      select: {
        id: true,
        counterpartyName: true,
        paymentPurpose: true,
        isPrivate: true,
        ownerMemberId: true,
      },
      where: { workspaceId, id: In(wanted) },
    });
    return matched(
      rows
        .filter(row => canReadPrivate(row, viewerMemberId))
        .map(row => [row.id, `${row.counterpartyName ?? ''} ${row.paymentPurpose ?? ''}`]),
    );
  }

  async forPayables(workspaceId: string, rawIds: readonly string[]): Promise<ItemKind[]> {
    const wanted = ids(rawIds);
    if (wanted.length === 0) {
      return [];
    }
    const rows = await this.payables.find({
      select: { id: true, vendor: true, comment: true },
      where: { workspaceId, id: In(wanted) },
    });
    return matched(rows.map(row => [row.id, `${row.vendor} ${row.comment ?? ''}`]));
  }
}

function matched(notes: Array<[string, string]>): ItemKind[] {
  const matcher = itemKindMatcher();
  return notes.flatMap(([subjectId, note]) => {
    const kind = matcher.match(note);
    return kind ? [{ subjectId, kind }] : [];
  });
}
