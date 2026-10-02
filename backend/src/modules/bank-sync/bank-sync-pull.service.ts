import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, type Repository } from 'typeorm';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { Integration, IntegrationStatus, Transaction, User } from '../../entities';
import { ImportConfigService } from '../import/config/import.config';
import type { ParsedTransaction } from '../parsing/interfaces/parsed-statement.interface';
import { IntelligentDeduplicationService } from '../parsing/services/intelligent-deduplication.service';
import { StatementsService } from '../statements/statements.service';
import type { BankSyncAccountSetting, BankSyncHealth } from './bank-sync.config';
import { linksOf } from './bank-sync.config';
import { BankSyncService } from './bank-sync.service';
import { buildOfxStatement, ofxFileName, providerRowKey } from './bank-sync-ofx.util';
import {
  type BankSyncAccount,
  BankSyncAuthError,
  BankSyncTemporaryError,
  type BankSyncTransaction,
} from './bank-sync-provider.interface';

/** How far back the first pull of an account reaches. */
const FIRST_SYNC_DAYS = 90;
/** Later pulls start this far before the previous one: posted dates settle late. */
const OVERLAP_DAYS = 7;
/** A balance this old means the provider stopped hearing from the bank. */
const STALE_BALANCE_DAYS = 14;
/** Money differences below this are rounding, not a missing row. */
const DRIFT_EPSILON = 0.01;
const DAY_MS = 24 * 60 * 60 * 1000;

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

/** Whether the balance gap is new this pull or was already there last time. */
type DriftState = 'none' | 'new' | 'persisting';

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
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly connections: BankSyncService,
    private readonly statementsService: StatementsService,
    private readonly deduplication: IntelligentDeduplicationService,
    private readonly importConfig: ImportConfigService,
  ) {}

  async sync(user: User, workspaceId: string, connectionId: string): Promise<BankSyncResult> {
    const { integration, settings } = await this.connections.require(workspaceId, connectionId);
    const provider = this.connections.providerOf(integration.provider);
    const config = this.connections.configOf(integration);
    const enabled = config.accounts.filter(account => account.enabled);
    const result: BankSyncResult = { ok: true, imported: 0, statements: 0, accounts: [] };
    if (enabled.length === 0) return result;

    const now = new Date();
    const since = new Date(
      Math.min(...enabled.map(account => this.sinceOf(account, now).getTime())),
    );

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
      where: { provider: In(keys), status: IntegrationStatus.CONNECTED },
      relations: ['openProtocolSettings', 'connectedByUser'],
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

    const floor = this.sinceOf(account, now).getTime();
    const candidates = remote.transactions.filter(
      item => !item.pending && item.posted.getTime() >= floor,
    );
    const fresh = await this.withoutKnownRows(workspaceId, account, candidates, remote.currency);
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
      const drift = this.recordDrift(account, remote, candidates, now);
      account.lastSyncAt = now.toISOString();
      account.balance = remote.balance;
      account.balanceDate = remote.balanceDate?.toISOString() ?? null;
      account.name = remote.name;
      account.consentExpiresAt = remote.consentExpiresAt?.toISOString() ?? account.consentExpiresAt;
      account.lastError = null;
      account.health = this.healthOf(account, drift, now);
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

  /**
   * The window this account is pulled over. `syncFrom` wins when it is set: a
   * feed that has just moved to another provider must not replay history the
   * wallet already holds.
   */
  private sinceOf(account: BankSyncAccountSetting, now: Date): Date {
    if (account.syncFrom) return new Date(account.syncFrom);
    if (account.lastSyncAt) {
      return new Date(new Date(account.lastSyncAt).getTime() - OVERLAP_DAYS * DAY_MS);
    }
    return new Date(now.getTime() - FIRST_SYNC_DAYS * DAY_MS);
  }

  /**
   * Drops rows the workspace already holds, in two passes.
   *
   * The provider's own id catches a re-pull of the same feed. It does not catch
   * the two cases that actually corrupt data: a feed moved to another provider,
   * which numbers the same purchase differently, and a bank that renumbers a
   * row when it moves from pending to booked. Those need the same tolerant
   * comparison a re-uploaded statement gets, so this reuses it rather than
   * inventing a second notion of "same transaction".
   */
  private async withoutKnownRows(
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
        select: ['documentNumber'],
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
      const parsed = this.asParsedTransaction(row, currency);
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

  /** The provider's row in the shape the tolerant comparison expects. */
  private asParsedTransaction(row: BankSyncTransaction, currency: string): ParsedTransaction {
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
   * Compares how far the provider's balance moved against the rows that arrived
   * to explain the move. A gap that is still there on the next pull is a row
   * that never came: the failure that otherwise hides behind a green dot.
   */
  private recordDrift(
    account: BankSyncAccountSetting,
    remote: BankSyncAccount,
    candidates: BankSyncTransaction[],
    now: Date,
  ): DriftState {
    const carriedOver = account.driftSince !== null;
    const previousBalance = account.balance;
    const previousBalanceDate = account.balanceDate ? new Date(account.balanceDate) : null;
    if (previousBalance === null || remote.balance === null || !previousBalanceDate) {
      account.balanceDrift = null;
      account.driftSince = null;
      return 'none';
    }
    const explained = candidates
      .filter(row => row.posted.getTime() > previousBalanceDate.getTime())
      .reduce((sum, row) => sum + row.amount, 0);
    const drift = Number((remote.balance - previousBalance - explained).toFixed(2));
    if (Math.abs(drift) <= DRIFT_EPSILON) {
      account.balanceDrift = null;
      account.driftSince = null;
      return 'none';
    }
    account.balanceDrift = drift;
    account.driftSince = account.driftSince ?? now.toISOString();
    return carriedOver ? 'persisting' : 'new';
  }

  private healthOf(account: BankSyncAccountSetting, drift: DriftState, now: Date): BankSyncHealth {
    if (drift === 'persisting') return 'incomplete';
    if (account.balanceDate) {
      const age = now.getTime() - new Date(account.balanceDate).getTime();
      if (age > STALE_BALANCE_DAYS * DAY_MS) return 'stale';
    }
    return 'ok';
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
