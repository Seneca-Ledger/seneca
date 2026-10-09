import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, type Repository } from 'typeorm';
import { BalanceAccount, BalanceAccountKind } from '../../entities/balance-account.entity';
import { BalanceSnapshot } from '../../entities/balance-snapshot.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { BalanceService } from '../balance/balance.service';
import { CryptoHoldingsService } from './crypto-holdings.service';

/** The section of the balance sheet the crypto line lives under. */
const INVESTMENTS_SECTION_CODE = 'ASSET_INVESTMENTS';

/**
 * Puts the wallets on the balance sheet.
 *
 * Net worth reads the sheet and nothing else, by design — so crypto becomes part
 * of it the same way an investment account does: one account, one snapshot per
 * day, written after every sync. That also gives the portfolio a history for
 * free, since a snapshot is dated and kept.
 */
@Injectable()
export class CryptoBalanceService {
  private readonly logger = new Logger(CryptoBalanceService.name);

  constructor(
    @InjectRepository(BalanceAccount)
    private readonly accountRepo: Repository<BalanceAccount>,
    @InjectRepository(BalanceSnapshot)
    private readonly snapshotRepo: Repository<BalanceSnapshot>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
    private readonly balanceService: BalanceService,
    private readonly holdingsService: CryptoHoldingsService,
  ) {}

  /**
   * Writes today's portfolio value as the crypto account's snapshot. Never throws:
   * a sheet that could not be updated must not fail the sync that did work.
   */
  async writePortfolioSnapshot(workspaceId: string, userId?: string | null): Promise<void> {
    try {
      const { currency, value } = await this.holdingsService.portfolioValue(workspaceId);
      const actorId = userId ?? (await this.anyMemberId(workspaceId));
      if (!actorId) {
        return;
      }
      const account = await this.ensureAccount(workspaceId, actorId);
      await this.balanceService.updateSnapshot(actorId, workspaceId, {
        accountId: account.id,
        amount: value,
        currency,
      });
    } catch (error) {
      this.logger.warn(`Crypto balance snapshot failed for workspace ${workspaceId}: ${error}`);
    }
  }

  /**
   * What the portfolio was worth, day by day. The points are the snapshots that
   * were actually written — the history starts when the first wallet was connected
   * and is not reconstructed backwards, because past balances are not knowable from
   * today's. A day with no sync simply has no point.
   */
  async getHistory(
    workspaceId: string,
    days: number,
  ): Promise<{ currency: string; series: { date: string; value: number }[] }> {
    const currency = await this.holdingsService.getWorkspaceCurrency(workspaceId);
    const account = await this.accountRepo.findOne({
      where: { workspaceId, accountKind: BalanceAccountKind.CRYPTO },
    });
    if (!account) {
      return { currency, series: [] };
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    const snapshots = await this.snapshotRepo.find({
      where: {
        workspaceId,
        accountId: account.id,
        snapshotDate: MoreThanOrEqual(since.toISOString().slice(0, 10)),
      },
      order: { snapshotDate: 'ASC' },
    });

    return {
      currency,
      series: snapshots.map(snapshot => ({
        date: String(snapshot.snapshotDate).slice(0, 10),
        value: Number(snapshot.amount),
      })),
    };
  }

  /** The workspace's crypto account, created on first use. */
  private async ensureAccount(workspaceId: string, userId: string): Promise<BalanceAccount> {
    const existing = await this.accountRepo.findOne({
      where: { workspaceId, accountKind: BalanceAccountKind.CRYPTO },
    });
    if (existing) {
      return existing;
    }

    await this.balanceService.seedDefaultAccounts(workspaceId);
    const section = await this.accountRepo.findOne({
      where: { workspaceId, code: INVESTMENTS_SECTION_CODE },
    });
    if (!section) {
      throw new Error('Investments section not found');
    }
    const created = await this.balanceService.createCustomAccount(userId, workspaceId, {
      name: 'Crypto',
      nameEn: 'Crypto',
      parentId: section.id,
    });
    await this.accountRepo.update(
      { id: created.id, workspaceId },
      { accountKind: BalanceAccountKind.CRYPTO },
    );
    return this.accountRepo.findOneByOrFail({ id: created.id });
  }

  /** The cron has no user of its own; the sheet still wants an author. */
  private async anyMemberId(workspaceId: string): Promise<string | null> {
    const member = await this.memberRepo.findOne({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
      select: ['id', 'userId'],
    });
    return member?.userId ?? null;
  }
}
