import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import type { BalanceHistoryPoint } from '../../contracts';
import {
  ActorType,
  AuditAction,
  BalanceAccount,
  BalanceSnapshot,
  EntityType,
  Workspace,
} from '../../entities';
import { AuditService } from '../audit/audit.service';

/** A row read from an imported file; the currency falls back to the workspace's. */
export type BalanceHistoryRow = { date: string; amount: number; currency?: string };

/**
 * An account's balance history as an object of its own: read it, take a wrong
 * day out, or bring a history kept elsewhere in whole.
 */
@Injectable()
export class BalanceHistoryService {
  constructor(
    @InjectRepository(BalanceAccount)
    private readonly balanceAccountRepository: Repository<BalanceAccount>,
    @InjectRepository(BalanceSnapshot)
    private readonly balanceSnapshotRepository: Repository<BalanceSnapshot>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Every value ever entered for one account, oldest first.
   *
   * The chart forward-fills between these, so this is the whole truth about
   * what the line does — and the only place a wrong day can be found and
   * taken out again.
   */
  async getAccountHistory(workspaceId: string, accountId: string): Promise<BalanceHistoryPoint[]> {
    await this.requireAccount(workspaceId, accountId);
    const snapshots = await this.balanceSnapshotRepository.find({
      where: { workspaceId, accountId },
      order: { snapshotDate: 'ASC' },
    });
    return snapshots.map(snapshot => ({
      date: toDateOnly(snapshot.snapshotDate),
      amount: toNumber(snapshot.amount),
      currency: snapshot.currency,
    }));
  }

  /**
   * Takes one day out of an account's history. A day with nothing entered is
   * already in the wanted state, so repeating the call is a no-op rather than
   * an error.
   */
  async deleteSnapshot(
    userId: string,
    workspaceId: string,
    accountId: string,
    date: string,
  ): Promise<{ deleted: boolean }> {
    const account = await this.requireEditableAccount(workspaceId, accountId);
    const snapshotDate = resolveDate(date);
    const snapshot = await this.balanceSnapshotRepository.findOne({
      where: { workspaceId, accountId: account.id, snapshotDate },
    });
    if (!snapshot) {
      return { deleted: false };
    }

    await this.balanceSnapshotRepository.remove(snapshot);
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.DELETE,
      meta: {
        kind: 'balance_snapshot',
        accountId: account.id,
        accountCode: account.code,
        snapshotDate,
      },
      diff: {
        before: { amount: toNumber(snapshot.amount), currency: snapshot.currency },
        after: null,
      },
    });
    return { deleted: true };
  }

  /**
   * Replays dated values onto one account, so a history kept somewhere else
   * can be brought in whole instead of typed in a day at a time. A date that
   * already has a value is overwritten; the rest of the history is left alone.
   */
  async importAccountHistory(
    userId: string,
    workspaceId: string,
    accountId: string,
    rows: BalanceHistoryRow[],
  ): Promise<{ imported: number }> {
    const account = await this.requireEditableAccount(workspaceId, accountId);
    if (rows.length === 0) {
      throw new BadRequestException(appError('BALANCE_HISTORY_EMPTY'));
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: { currency: true },
    });
    const fallbackCurrency = currencyCodeOrDefault(workspace?.currency);
    // Last one wins, so a file that repeats a day imports it once.
    const byDate = new Map<string, BalanceHistoryRow>();
    for (const row of rows) {
      byDate.set(resolveDate(row.date), row);
    }

    await this.balanceSnapshotRepository.manager.transaction(async manager => {
      const repository = manager.getRepository(BalanceSnapshot);
      for (const [snapshotDate, row] of byDate) {
        const existing = await repository.findOne({
          where: { workspaceId, accountId: account.id, snapshotDate },
        });
        const values = {
          amount: round2(row.amount),
          currency: row.currency || fallbackCurrency,
          createdBy: userId,
        };
        await repository.save(
          existing
            ? Object.assign(existing, values)
            : repository.create({ workspaceId, accountId: account.id, snapshotDate, ...values }),
        );
      }
    });

    const dates = [...byDate.keys()].sort();
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.UPDATE,
      meta: {
        kind: 'balance_history_import',
        accountId: account.id,
        accountCode: account.code,
        from: dates[0],
        to: dates[dates.length - 1],
        rows: byDate.size,
      },
    });

    return { imported: byDate.size };
  }

  private async requireAccount(workspaceId: string, accountId: string): Promise<BalanceAccount> {
    const account = await this.balanceAccountRepository.findOne({
      where: { id: accountId, workspaceId },
    });
    if (!account) {
      throw new NotFoundException(appError('BALANCE_ACCOUNT_NOT_FOUND'));
    }
    return account;
  }

  private async requireEditableAccount(
    workspaceId: string,
    accountId: string,
  ): Promise<BalanceAccount> {
    const account = await this.requireAccount(workspaceId, accountId);
    if (!account.isEditable) {
      throw new BadRequestException(appError('BALANCE_LINE_AUTO_CALCULATED'));
    }
    return account;
  }
}

function toDateOnly(value: string | Date): string {
  return new Date(value).toISOString().split('T')[0];
}

function resolveDate(date: string): string {
  const asDate = new Date(date);
  if (Number.isNaN(asDate.getTime())) {
    throw new BadRequestException(appError('BALANCE_DATE_INVALID'));
  }
  return asDate.toISOString().split('T')[0];
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
