import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { decryptText, encryptText } from '../../common/utils/encryption.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import type { UpdateBankSyncSettingsBody } from '../../contracts';
import {
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  OpenProtocolSettings,
  Transaction,
  User,
  Wallet,
} from '../../entities';
import { StatementsService } from '../statements/statements.service';
import { buildOfxStatement, ofxFileName, providerRowKey } from './bank-sync-ofx.util';
import { type BankSyncAccount, BankSyncAuthError } from './bank-sync-provider.interface';
import { SimpleFinProvider } from './simplefin.provider';

/** How far back the first pull of an account reaches. */
const FIRST_SYNC_DAYS = 90;
/** Later pulls start this far before the previous one: posted dates settle late. */
const OVERLAP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BankSyncAccountSetting {
  id: string;
  name: string;
  org: string;
  currency: string;
  /** Off: listed but never pulled. New accounts found after connecting start off. */
  enabled: boolean;
  walletId: string | null;
  lastSyncAt: string | null;
  balance: number | null;
  balanceDate: string | null;
}

export interface BankSyncConfig {
  provider: 'simplefin';
  autoSync: boolean;
  accounts: BankSyncAccountSetting[];
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface BankSyncStatus {
  connected: boolean;
  status: IntegrationStatus;
  settings: BankSyncConfig | null;
  scopes: string[];
}

export interface BankSyncResult {
  ok: true;
  /** Rows handed to statement import (its own dedupe may still drop some). */
  imported: number;
  statements: number;
  accounts: Array<{ id: string; imported: number; statementId: string | null; error?: string }>;
}

const EMPTY_CONFIG: BankSyncConfig = {
  provider: 'simplefin',
  autoSync: true,
  accounts: [],
  lastSyncAt: null,
  lastError: null,
};

/**
 * Bank sync through the user's own aggregator account. Seneca stores the
 * credential encrypted next to the other open-protocol integrations, pulls on
 * demand or every six hours, and feeds each account's new rows to statement
 * import as an OFX file, so everything downstream (dedupe, rules, review
 * inbox, audit) is the same path a hand-uploaded statement takes.
 */
@Injectable()
export class BankSyncService {
  private readonly logger = new Logger(BankSyncService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(OpenProtocolSettings)
    private readonly settingsRepository: Repository<OpenProtocolSettings>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly statementsService: StatementsService,
    private readonly provider: SimpleFinProvider,
  ) {}

  async status(workspaceId: string): Promise<BankSyncStatus> {
    const { integration, settings } = await this.find(workspaceId);
    const connected =
      !!integration && integration.status !== IntegrationStatus.DISCONNECTED && !!settings;
    return {
      connected,
      status: integration?.status ?? IntegrationStatus.DISCONNECTED,
      settings: connected ? this.configOf(settings) : null,
      scopes: [],
    };
  }

  /** Setup token → credential → account list; every account starts enabled. */
  async connect(user: User, workspaceId: string, setupToken: string): Promise<BankSyncStatus> {
    const credential = await this.provider.claim(setupToken);
    const accounts = await this.provider.fetchAccounts(credential, { balancesOnly: true });
    const previous = this.configOf((await this.find(workspaceId)).settings);
    const config: BankSyncConfig = {
      ...EMPTY_CONFIG,
      autoSync: previous.autoSync,
      accounts: accounts.map(account =>
        this.accountSetting(
          account,
          previous.accounts.find(item => item.id === account.id),
          true,
        ),
      ),
    };
    await this.save(user, workspaceId, config, { accessUrl: encryptText(credential) });
    return this.status(workspaceId);
  }

  async updateSettings(
    workspaceId: string,
    dto: UpdateBankSyncSettingsBody,
  ): Promise<BankSyncStatus> {
    const { settings } = await this.requireConnected(workspaceId);
    const config = this.configOf(settings);
    if (dto.autoSync != null) config.autoSync = dto.autoSync;
    if (dto.accounts) {
      const walletIds = dto.accounts
        .map(item => item.walletId)
        .filter((id): id is string => typeof id === 'string');
      const wallets = walletIds.length
        ? await this.walletRepository.find({
            where: { workspaceId, id: In(walletIds) },
            select: {
              id: true,
            },
          })
        : [];
      const known = new Set(wallets.map(wallet => wallet.id));
      for (const change of dto.accounts) {
        const account = config.accounts.find(item => item.id === change.id);
        if (!account) throw new NotFoundException(`Account ${change.id} is not in this connection`);
        if (change.enabled != null) account.enabled = change.enabled;
        if (change.walletId !== undefined) {
          if (change.walletId !== null && !known.has(change.walletId)) {
            throw new BadRequestException('Wallet does not belong to this workspace');
          }
          account.walletId = change.walletId;
        }
      }
    }
    settings.config = config as unknown as Record<string, unknown>;
    await this.settingsRepository.save(settings);
    return this.status(workspaceId);
  }

  /** Asks the provider for the account list again; accounts seen for the first time start disabled. */
  async refreshAccounts(workspaceId: string): Promise<BankSyncStatus> {
    const { integration, settings } = await this.requireConnected(workspaceId);
    const config = this.configOf(settings);
    const accounts = await this.guard(integration, () =>
      this.provider.fetchAccounts(this.credentialOf(settings), { balancesOnly: true }),
    );
    config.accounts = accounts.map(account =>
      this.accountSetting(
        account,
        config.accounts.find(item => item.id === account.id),
        false,
      ),
    );
    settings.config = config as unknown as Record<string, unknown>;
    await this.settingsRepository.save(settings);
    return this.status(workspaceId);
  }

  async sync(user: User, workspaceId: string): Promise<BankSyncResult> {
    const { integration, settings } = await this.requireConnected(workspaceId);
    const config = this.configOf(settings);
    const enabled = config.accounts.filter(account => account.enabled);
    const result: BankSyncResult = { ok: true, imported: 0, statements: 0, accounts: [] };
    if (enabled.length === 0) return result;

    const now = new Date();
    const sinceOf = (account: BankSyncAccountSetting) =>
      account.lastSyncAt
        ? new Date(new Date(account.lastSyncAt).getTime() - OVERLAP_DAYS * DAY_MS)
        : new Date(now.getTime() - FIRST_SYNC_DAYS * DAY_MS);
    const since = new Date(Math.min(...enabled.map(account => sinceOf(account).getTime())));

    let pulled: BankSyncAccount[];
    try {
      pulled = await this.guard(integration, () =>
        this.provider.fetchAccounts(this.credentialOf(settings), { since }),
      );
    } catch (error) {
      config.lastError = this.messageOf(error);
      settings.config = config as unknown as Record<string, unknown>;
      await this.settingsRepository.save(settings);
      throw error;
    }

    for (const account of enabled) {
      const remote = pulled.find(item => item.id === account.id);
      if (!remote) {
        result.accounts.push({
          id: account.id,
          imported: 0,
          statementId: null,
          error: 'not returned by provider',
        });
        continue;
      }
      const floor = sinceOf(account).getTime();
      const candidates = remote.transactions.filter(
        item => !item.pending && item.posted.getTime() >= floor,
      );
      const fresh = await this.withoutKnownRows(workspaceId, account.id, candidates);
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
          result.imported += fresh.length;
          result.statements += 1;
        } catch (importError) {
          error = this.messageOf(importError);
          this.logger.warn(`Bank sync: account ${account.id} import failed: ${error}`);
        }
      }
      if (!error) {
        account.lastSyncAt = now.toISOString();
        account.balance = remote.balance;
        account.balanceDate = remote.balanceDate?.toISOString() ?? null;
        account.name = remote.name;
      }
      result.accounts.push({
        id: account.id,
        imported: error ? 0 : fresh.length,
        statementId,
        ...(error ? { error } : {}),
      });
    }

    config.lastSyncAt = now.toISOString();
    config.lastError = result.accounts.find(item => item.error)?.error ?? null;
    settings.config = config as unknown as Record<string, unknown>;
    settings.lastSyncAt = now;
    await this.settingsRepository.save(settings);
    return result;
  }

  /** Forgets the credential; the imported statements stay. */
  async disconnect(workspaceId: string): Promise<{ ok: true }> {
    const { integration, settings } = await this.find(workspaceId);
    if (settings) {
      settings.encryptedSecrets = {};
      settings.config = { ...this.configOf(settings), accounts: [] } as unknown as Record<
        string,
        unknown
      >;
      await this.settingsRepository.save(settings);
    }
    if (integration) {
      integration.status = IntegrationStatus.DISCONNECTED;
      await this.integrationRepository.save(integration);
    }
    return { ok: true };
  }

  /** Pulls every connected workspace that left auto-sync on, as the user who connected it. */
  @Cron(CronExpression.EVERY_6_HOURS)
  async autoSync(): Promise<void> {
    const integrations = await this.integrationRepository.find({
      // A past version pulls nothing new, whatever its copied settings say.
      where: {
        provider: IntegrationProvider.SIMPLEFIN,
        status: IntegrationStatus.CONNECTED,
        workspace: STANDARD_WORKSPACE,
      },
      relations: {
        openProtocolSettings: true,
        connectedByUser: true,
      },
    });
    for (const integration of integrations) {
      const config = this.configOf(integration.openProtocolSettings);
      if (!(config.autoSync && integration.connectedByUser)) continue;
      try {
        const result = await this.sync(integration.connectedByUser, integration.workspaceId);
        if (result.imported > 0) {
          this.logger.log(
            `Bank sync: workspace ${integration.workspaceId} pulled ${result.imported} rows into ${result.statements} statements`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Bank sync: workspace ${integration.workspaceId} failed: ${this.messageOf(error)}`,
        );
      }
    }
  }

  private async importAsStatement(
    user: User,
    workspaceId: string,
    account: BankSyncAccount,
    transactions: BankSyncAccount['transactions'],
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

  /** Drops rows whose account-scoped provider id is already a document number in this workspace. */
  private async withoutKnownRows<T extends { id: string }>(
    workspaceId: string,
    accountId: string,
    rows: T[],
  ): Promise<T[]> {
    if (rows.length === 0) return rows;
    const known = new Set<string>();
    const ids = rows.map(row => providerRowKey(accountId, row.id));
    for (let offset = 0; offset < ids.length; offset += 500) {
      const existing = await this.transactionRepository.find({
        where: { workspaceId, documentNumber: In(ids.slice(offset, offset + 500)) },
        select: {
          documentNumber: true,
        },
      });
      for (const row of existing) {
        if (row.documentNumber) known.add(row.documentNumber);
      }
    }
    return rows.filter(row => !known.has(providerRowKey(accountId, row.id)));
  }

  /** Runs a provider call; a rejected credential flips the integration to "needs re-auth". */
  private async guard<T>(integration: Integration, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof BankSyncAuthError) {
        integration.status = IntegrationStatus.NEEDS_REAUTH;
        await this.integrationRepository.save(integration);
        throw new BadRequestException(
          'SimpleFIN no longer accepts this connection: paste a new setup token',
        );
      }
      throw error;
    }
  }

  private async find(workspaceId: string) {
    const integration = await this.integrationRepository.findOne({
      where: { workspaceId, provider: IntegrationProvider.SIMPLEFIN },
      relations: {
        openProtocolSettings: true,
      },
    });
    return { integration, settings: integration?.openProtocolSettings ?? null };
  }

  private async requireConnected(workspaceId: string) {
    const { integration, settings } = await this.find(workspaceId);
    if (!integration || integration.status === IntegrationStatus.DISCONNECTED || !settings) {
      throw new BadRequestException('Bank sync is not connected');
    }
    if (!settings.encryptedSecrets?.accessUrl) {
      throw new BadRequestException('Bank sync is not connected');
    }
    return { integration, settings };
  }

  private async save(
    user: User,
    workspaceId: string,
    config: BankSyncConfig,
    secrets: Record<string, string>,
  ): Promise<void> {
    const existing = await this.find(workspaceId);
    const integration =
      existing.integration ??
      this.integrationRepository.create({
        workspaceId,
        provider: IntegrationProvider.SIMPLEFIN,
        scopes: [],
      });
    integration.status = IntegrationStatus.CONNECTED;
    integration.connectedByUserId = user.id;
    const saved = await this.integrationRepository.save(integration);
    const settings =
      existing.settings ??
      this.settingsRepository.create({ integrationId: saved.id, lastSyncAt: null });
    settings.config = config as unknown as Record<string, unknown>;
    settings.encryptedSecrets = secrets;
    await this.settingsRepository.save(settings);
  }

  private credentialOf(settings: OpenProtocolSettings): string {
    return decryptText(settings.encryptedSecrets.accessUrl);
  }

  private configOf(settings: OpenProtocolSettings | null | undefined): BankSyncConfig {
    const raw = (settings?.config ?? {}) as Partial<BankSyncConfig>;
    return {
      provider: 'simplefin',
      autoSync: raw.autoSync ?? EMPTY_CONFIG.autoSync,
      accounts: Array.isArray(raw.accounts) ? raw.accounts.map(item => ({ ...item })) : [],
      lastSyncAt: raw.lastSyncAt ?? null,
      lastError: raw.lastError ?? null,
    };
  }

  private accountSetting(
    account: BankSyncAccount,
    previous: BankSyncAccountSetting | undefined,
    enabledWhenNew: boolean,
  ): BankSyncAccountSetting {
    return {
      id: account.id,
      name: account.name,
      org: account.org,
      currency: account.currency,
      enabled: previous?.enabled ?? enabledWhenNew,
      walletId: previous?.walletId ?? null,
      lastSyncAt: previous?.lastSyncAt ?? null,
      balance: account.balance,
      balanceDate: account.balanceDate?.toISOString() ?? null,
    };
  }

  private messageOf(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
