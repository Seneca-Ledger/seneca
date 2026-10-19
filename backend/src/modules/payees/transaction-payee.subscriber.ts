import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { payeeKeyOf } from '../../common/utils/payee-key.util';
import { Transaction } from '../../entities/transaction.entity';
import { resolvePayeeId } from './payee-resolution';

/**
 * Gives every transaction its payee as it is written, whichever of the many
 * paths books it (import, scan, receipt, payable, manual entry, custom table,
 * Telegram). Only `save()` reaches a subscriber: a path that writes with
 * `update()` or a raw insert has to call `resolvePayeeId` itself.
 */
@Injectable()
export class TransactionPayeeSubscriber implements EntitySubscriberInterface<Transaction> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Transaction;
  }

  async beforeInsert(event: InsertEvent<Transaction>): Promise<void> {
    const transaction = event.entity;
    if (!transaction?.workspaceId || transaction.payeeId) {
      return;
    }
    transaction.payeeId = await resolvePayeeId(event.manager, transaction.workspaceId, transaction);
  }

  /** A corrected descriptor moves the row to that descriptor's payee, unless the payee was picked in the same write. */
  async beforeUpdate(event: UpdateEvent<Transaction>): Promise<void> {
    const transaction = event.entity as Transaction | undefined;
    const before = event.databaseEntity;
    if (!(transaction?.workspaceId && before) || transaction.counterpartyName === undefined) {
      return;
    }
    if (transaction.payeeId !== before.payeeId) {
      return;
    }
    if (payeeKeyOf(transaction) === before.payeeKey) {
      return;
    }
    transaction.payeeId = await resolvePayeeId(event.manager, transaction.workspaceId, transaction);
  }
}
