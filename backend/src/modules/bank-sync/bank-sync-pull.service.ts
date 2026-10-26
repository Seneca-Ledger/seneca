import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import { Integration, IntegrationStatus, User } from '../../entities';
import { StatementsService } from '../statements/statements.service';
import type { BankSyncAccountSetting, BankSyncHealth } from './bank-sync.config';
import { linksOf } from './bank-sync.config';
import { BankSyncService } from './bank-sync.service';
import { BankSyncDedupeService } from './bank-sync-dedupe.service';
import { healthOf, recordDrift, sinceOf } from './bank-sync-health';
import { buildOfxStatement, ofxFileName } from './bank-sync-ofx.util';
import {
  type BankSyncAccount,
  BankSyncAuthError,
  BankSyncTemporaryError,
  type BankSyncTransaction,
} from './bank-sync-provider.interface';

export interface BankSyncAccountResult {
  id: string;
  imported: number;
  /** Rows the provider sent that we already had. */
  skipped: number;
  statementId: string | null;
  health: BankSyncHealth;
  error?: string;
}

export interface BankSyncResult {
  ok: true;
  imported: number;
  statements: number;
  accounts: BankSyncAccountResult[];
}

/**
 * Pulls one connection and feeds what it finds to statement import, so dedupe,
 * rules, the review inbox and the audit trail are the same path a
 * hand-uploaded statement takes.
 */
@Injectable()
export class BankSyncPullService {
  private readonly logger = new Logger(BankSyncPullService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly connections: BankSyncService,
    private readonly statementsService: StatementsService,
    private readonly dedupe: BankSyncDedupeService,
  ) {}

  async sync(user: User, workspaceId: string, connectionId: string): Promise<BankSyncResult> {
    const { integration, settings } = await this.connections.require(workspaceId, connectionId);
    const provider = this.connections.providerOf(integration.provider);
    const config = this.connections.configOf(integration);
    const enabled = config.accounts.filter(account => account.enabled);
    const result: BankSyncResult = { ok: true, imported: 0, statements: 0, accounts: [] };
    if (enabled.length === 0) return result;

    const now = new Date();
    const since = new Date(Math.min(...enabled.map(account => sinceOf(account, now).getTime())));

    let pulled: BankSyncAccount[];
    try {
      pulled = await this.guard(integration, () =>
        provider.fetchAccounts(
          { secrets: this.connections.secretsOf(integration), links: linksOf(config) },
          { since },
        ),
      );
    } catch (error) {
      config.lastError = this.messageOf(error);
      await this.connections.saveConfig(settings, config);
      throw error;
    }

    for (const account of enabled) {
      result.accounts.push(await this.pullAccount(user, workspaceId, account, pulled, now, result));
    }

    config.lastSyncAt = now.toISOString();
    config.lastError = result.accounts.find(item => item.error)?.error ?? null;
    settings.lastSyncAt = now;
    await this.connections.saveConfig(settings, config);
    return result;
  }

  /** Pulls every connected workspace that left auto-sync on, as the user who connected it. */
  @Cron(CronExpression.EVERY_6_HOURS)
  async autoSync(): Promise<void> {
    const keys = this.connections.catalogue().map(item => item.key);
    const integrations = await this.integrationRepository.find({
      // A past version pulls nothing new, whatever its copied settings say.
      where: {
        provider: In(keys),
        status: IntegrationStatus.CONNECTED,
        workspace: STANDARD_WORKSPACE,
      },
      relations: { openProtocolSettings: true, connectedByUser: true },
    });
    for (const integration of integrations) {
      const config = this.connections.configOf(integration);
      if (!(config.autoSync && integration.connectedByUser)) continue;
      try {
        const result = await this.sync(
          integration.connectedByUser,
          integration.workspaceId,
          integration.id,
        );
        if (result.imported > 0) {
          this.logger.log(
            `Bank sync: connection ${integration.id} pulled ${result.imported} rows into ${result.statements} statements`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Bank sync: connection ${integration.id} failed: ${this.messageOf(error)}`,
        );
      }
    }
  }

  private async pullAccount(
    user: User,
    workspaceId: string,
    account: BankSyncAccountSetting,
    pulled: BankSyncAccount[],
    now: Date,
    totals: BankSyncResult,
  ): Promise<BankSyncAccountResult> {
    const remote = pulled.find(item => item.id === account.id);
    if (!remote) {
      account.health = 'stale';
      account.lastError = 'not returned by provider';
      return {
        id: account.id,
        imported: 0,
        skipped: 0,
        statementId: null,
        health: account.health,
        error: account.lastError,
      };
    }

    const floor = sinceOf(account, now).getTime();
    const candidates = remote.transactions.filter(
      item => !item.pending && item.posted.getTime() >= floor,
    );
    const fresh = await this.dedupe.withoutKnownRows(
      workspaceId,
      account,
      candidates,
      remote.currency,
    );
    let statementId: string | null = null;
    let error: string | undefined;
    if (fresh.length > 0) {
      try {
        statementId = await this.importAsStatement(
          user,
          workspaceId,
          remote,
          fresh,
          account.walletId,
        );
        totals.imported += fresh.length;
        totals.statements += 1;
      } catch (importError) {
        error = this.messageOf(importError);
        this.logger.warn(`Bank sync: account ${account.id} import failed: ${error}`);
      }
    }

    if (!error) {
      const drift = recordDrift(account, remote, candidates, now);
      account.lastSyncAt = now.toISOString();
      account.balance = remote.balance;
      account.balanceDate = remote.balanceDate?.toISOString() ?? null;
      account.name = remote.name;
      account.consentExpiresAt = remote.consentExpiresAt?.toISOString() ?? account.consentExpiresAt;
      account.lastError = null;
      account.health = healthOf(account, drift, now);
      // The floor only ever applies to the pull right after a switch.
      account.syncFrom = null;
    } else {
      account.lastError = error;
    }

    return {
      id: account.id,
      imported: error ? 0 : fresh.length,
      skipped: candidates.length - fresh.length,
      statementId,
      health: account.health,
      ...(error ? { error } : {}),
    };
  }

  private async importAsStatement(
    user: User,
    workspaceId: string,
    account: BankSyncAccount,
    transactions: BankSyncTransaction[],
    walletId: string | null,
  ): Promise<string> {
    const uploadsDir = resolveUploadsDir();
    await fs.promises.mkdir(uploadsDir, { recursive: true });
    const content = Buffer.from(buildOfxStatement(account, transactions), 'utf8');
    const filePath = path.join(uploadsDir, `${randomUUID()}.ofx`);
    await fs.promises.writeFile(filePath, content);
    const file = {
      fieldname: 'files',
      originalname: ofxFileName(account),
      encoding: '7bit',
      mimetype: 'application/x-ofx',
      size: content.length,
      destination: uploadsDir,
      filename: path.basename(filePath),
      path: filePath,
      buffer: content,
    } as Express.Multer.File;
    try {
      const statement = await this.statementsService.create(
        user,
        workspaceId,
        file,
        walletId ?? undefined,
      );
      return statement.id;
    } catch (error) {
      await fs.promises.unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Translates a provider failure into the right advice. A rejected credential
   * means re-link; a rate limit or a connection the provider is still repairing
   * means wait, and must not tell the user to re-link.
   */
  private async guard<T>(integration: Integration, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof BankSyncAuthError) {
        integration.status = IntegrationStatus.NEEDS_REAUTH;
        await this.integrationRepository.save(integration);
      }
      throw error;
    }
  }

  private messageOf(error: unknown): string {
    if (error instanceof BankSyncTemporaryError) return `${error.message} (temporary)`;
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
