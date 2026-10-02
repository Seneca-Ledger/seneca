import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { decryptText, encryptText } from '../../common/utils/encryption.util';
import {
  Integration,
  IntegrationStatus,
  OpenProtocolSettings,
  Transaction,
  User,
  Wallet,
} from '../../entities';
import {
  accountSettingOf,
  type BankSyncConnectionConfig,
  linkSettingOf,
  linksOf,
  normalizeConfig,
} from './bank-sync.config';
import {
  BANK_SYNC_PROVIDERS,
  type BankSyncInstitution,
  type BankSyncProvider,
  isRedirectProvider,
  type RedirectBankSyncProvider,
  type TokenBankSyncProvider,
} from './bank-sync-provider.interface';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BankSyncConnection {
  id: string;
  provider: string;
  linkStyle: 'token' | 'redirect';
  label: string;
  status: IntegrationStatus;
  config: BankSyncConnectionConfig;
}

/**
 * The connections a workspace holds with bank-data providers, and which wallet
 * each provider account feeds.
 *
 * A workspace may hold several connections, including several with the same
 * provider: Enable Banking's free tier gives one application access only to
 * the accounts of the person who linked them, so a couple sharing a workspace
 * needs one connection each. The pull itself lives in BankSyncPullService.
 */
@Injectable()
export class BankSyncService {
  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(OpenProtocolSettings)
    private readonly settingsRepository: Repository<OpenProtocolSettings>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @Inject(BANK_SYNC_PROVIDERS)
    private readonly providers: BankSyncProvider[],
  ) {}

  /** The providers this build can offer, for the "add a connection" screen. */
  catalogue(): Array<{ key: string; linkStyle: 'token' | 'redirect' }> {
    return this.providers.map(provider => ({
      key: provider.key,
      linkStyle: provider.linkStyle,
    }));
  }

  async list(workspaceId: string): Promise<BankSyncConnection[]> {
    const integrations = await this.integrationRepository.find({
      where: { workspaceId, provider: In(this.providers.map(item => item.key)) },
      relations: ['openProtocolSettings'],
      order: { createdAt: 'ASC' },
    });
    return integrations
      .filter(integration => integration.status !== IntegrationStatus.DISCONNECTED)
      .map(integration => this.present(integration));
  }

  /** SimpleFIN style: the pasted token becomes the credential, and the accounts arrive at once. */
  async connectWithToken(
    user: User,
    workspaceId: string,
    providerKey: string,
    setupToken: string,
    label?: string,
  ): Promise<BankSyncConnection> {
    const provider = this.tokenProvider(providerKey);
    const secrets = await provider.claim(setupToken);
    const integration = await this.createIntegration(user, workspaceId, providerKey);
    const config = normalizeConfig({ label: label || providerKey }, providerKey);
    const accounts = await provider.fetchAccounts({ secrets, links: [] }, { balancesOnly: true });
    config.accounts = accounts.map(account => accountSettingOf(account, undefined, true));
    await this.persist(integration, config, this.encryptSecrets(secrets));
    return this.present(await this.reload(integration.id));
  }

  /**
   * Enable Banking style: the application credentials are stored first, banks
   * are authorized afterwards one at a time.
   */
  async createRedirectConnection(
    user: User,
    workspaceId: string,
    providerKey: string,
    secrets: Record<string, string>,
    label?: string,
  ): Promise<BankSyncConnection> {
    const provider = this.redirectProvider(providerKey);
    await provider.verifyCredentials(secrets);
    const integration = await this.createIntegration(user, workspaceId, providerKey);
    const config = normalizeConfig({ label: label || providerKey }, providerKey);
    await this.persist(integration, config, this.encryptSecrets(secrets));
    return this.present(await this.reload(integration.id));
  }

  async listInstitutions(
    workspaceId: string,
    connectionId: string,
    country: string,
  ): Promise<BankSyncInstitution[]> {
    const { integration } = await this.require(workspaceId, connectionId);
    const provider = this.redirectProvider(integration.provider);
    return provider.listInstitutions(this.secretsOf(integration), country);
  }

  /** Starts a bank authorization and remembers the state the callback must echo. */
  async beginLink(
    workspaceId: string,
    connectionId: string,
    input: {
      institution: string;
      country: string;
      redirectUrl: string;
      maxConsentValiditySeconds?: number | null;
    },
  ): Promise<{ url: string; state: string }> {
    const { integration, settings } = await this.require(workspaceId, connectionId);
    const provider = this.redirectProvider(integration.provider);
    const state = randomUUID();
    const { url } = await provider.beginLink(this.secretsOf(integration), {
      institution: input.institution,
      country: input.country,
      redirectUrl: input.redirectUrl,
      state,
      maxConsentValiditySeconds: input.maxConsentValiditySeconds,
    });
    const config = this.configOf(integration);
    config.pendingLink = { state, institution: input.institution, country: input.country };
    await this.saveConfig(settings, config);
    return { url, state };
  }

  /**
   * Finishes the authorization the user started. The state has to be the one we
   * handed out: a code arriving with anything else is not ours to redeem.
   */
  async completeLink(
    workspaceId: string,
    connectionId: string,
    code: string,
    state: string,
  ): Promise<BankSyncConnection> {
    const { integration, settings } = await this.require(workspaceId, connectionId);
    const provider = this.redirectProvider(integration.provider);
    const config = this.configOf(integration);
    if (!config.pendingLink || config.pendingLink.state !== state) {
      throw new BadRequestException('This authorization was not started here, or has expired');
    }
    const secrets = this.secretsOf(integration);
    const link = await provider.completeLink(secrets, code);
    config.pendingLink = null;
    config.links = [...config.links.filter(item => item.id !== link.id), linkSettingOf(link)];
    const accounts = await provider.fetchAccounts(
      { secrets, links: linksOf(config) },
      { balancesOnly: true },
    );
    const known = new Map(config.accounts.map(account => [account.id, account]));
    // Accounts from a link the user just authorized start on: they asked for them.
    config.accounts = accounts.map(account =>
      accountSettingOf(account, known.get(account.id), account.linkId === link.id),
    );
    integration.status = IntegrationStatus.CONNECTED;
    await this.integrationRepository.save(integration);
    await this.saveConfig(settings, config);
    return this.present(await this.reload(integration.id));
  }

  /** Asks the provider for the account list again; accounts seen for the first time start off. */
  async refreshAccounts(workspaceId: string, connectionId: string): Promise<BankSyncConnection> {
    const { integration, settings } = await this.require(workspaceId, connectionId);
    const provider = this.providerOf(integration.provider);
    const config = this.configOf(integration);
    const accounts = await provider.fetchAccounts(
      { secrets: this.secretsOf(integration), links: linksOf(config) },
      { balancesOnly: true },
    );
    const known = new Map(config.accounts.map(account => [account.id, account]));
    config.accounts = accounts.map(account =>
      accountSettingOf(account, known.get(account.id), false),
    );
    await this.saveConfig(settings, config);
    return this.present(await this.reload(integration.id));
  }

  async updateConnection(
    workspaceId: string,
    connectionId: string,
    changes: { label?: string; autoSync?: boolean },
  ): Promise<BankSyncConnection> {
    const { integration, settings } = await this.require(workspaceId, connectionId);
    const config = this.configOf(integration);
    if (changes.label !== undefined) config.label = changes.label;
    if (changes.autoSync !== undefined) config.autoSync = changes.autoSync;
    await this.saveConfig(settings, config);
    return this.present(await this.reload(integration.id));
  }

  /**
   * Turns one provider account on or off, or points it at a wallet. A wallet
   * takes at most one feed across the whole workspace, so a second claim on it
   * is refused rather than silently doubling its rows.
   */
  async updateAccount(
    workspaceId: string,
    connectionId: string,
    accountId: string,
    changes: { enabled?: boolean; walletId?: string | null },
  ): Promise<BankSyncConnection> {
    const { integration, settings } = await this.require(workspaceId, connectionId);
    const config = this.configOf(integration);
    const account = config.accounts.find(item => item.id === accountId);
    if (!account) throw new NotFoundException(`Account ${accountId} is not in this connection`);
    if (changes.walletId !== undefined) {
      if (changes.walletId !== null) {
        await this.requireWallet(workspaceId, changes.walletId);
        await this.requireWalletFree(workspaceId, changes.walletId, connectionId, accountId);
      }
      account.walletId = changes.walletId;
    }
    if (changes.enabled !== undefined) account.enabled = changes.enabled;
    await this.saveConfig(settings, config);
    return this.present(await this.reload(integration.id));
  }

  /**
   * Moves a wallet's feed to another provider without starting over.
   *
   * The history stays where it is: nothing is deleted, and the new feed is told
   * to begin the day after the wallet's last known row. Providers replay their
   * full history on a fresh link and disagree with each other about dates, so
   * without that floor a switch means hundreds of near-duplicate rows — the
   * single loudest complaint about doing this anywhere else.
   */
  async switchFeed(
    workspaceId: string,
    input: { walletId: string; toConnectionId: string; toAccountId: string },
  ): Promise<{
    from: { connectionId: string; accountId: string } | null;
    syncFrom: string | null;
  }> {
    await this.requireWallet(workspaceId, input.walletId);
    const target = await this.require(workspaceId, input.toConnectionId);
    const targetConfig = this.configOf(target.integration);
    const targetAccount = targetConfig.accounts.find(item => item.id === input.toAccountId);
    if (!targetAccount) {
      throw new NotFoundException(`Account ${input.toAccountId} is not in this connection`);
    }
    if (targetAccount.walletId && targetAccount.walletId !== input.walletId) {
      throw new BadRequestException('That provider account already feeds another wallet');
    }

    const previous = await this.feedOf(workspaceId, input.walletId);
    const lastRow = await this.lastTransactionDate(workspaceId, input.walletId);
    const syncFrom = lastRow ? new Date(lastRow.getTime() + DAY_MS) : null;

    if (
      previous &&
      !(previous.connectionId === input.toConnectionId && previous.accountId === input.toAccountId)
    ) {
      const source = await this.require(workspaceId, previous.connectionId);
      const sourceConfig = this.configOf(source.integration);
      const sourceAccount = sourceConfig.accounts.find(item => item.id === previous.accountId);
      if (sourceAccount) {
        sourceAccount.walletId = null;
        sourceAccount.enabled = false;
      }
      await this.saveConfig(source.settings, sourceConfig);
    }

    targetAccount.walletId = input.walletId;
    targetAccount.enabled = true;
    targetAccount.syncFrom = syncFrom ? syncFrom.toISOString() : null;
    targetAccount.lastSyncAt = null;
    targetAccount.health = 'never_synced';
    targetAccount.lastError = null;
    targetAccount.balanceDrift = null;
    await this.saveConfig(target.settings, targetConfig);

    return {
      from: previous,
      syncFrom: syncFrom ? syncFrom.toISOString() : null,
    };
  }

  /** Forgets the credentials; the imported statements and transactions stay. */
  async disconnect(workspaceId: string, connectionId: string): Promise<{ ok: true }> {
    const { integration, settings } = await this.require(workspaceId, connectionId);
    settings.encryptedSecrets = {};
    const config = this.configOf(integration);
    await this.saveConfig(settings, { ...config, accounts: [], links: [], pendingLink: null });
    integration.status = IntegrationStatus.DISCONNECTED;
    await this.integrationRepository.save(integration);
    return { ok: true };
  }

  /** Which provider account feeds this wallet, if any. */
  async feedOf(
    workspaceId: string,
    walletId: string,
  ): Promise<{ connectionId: string; accountId: string } | null> {
    for (const connection of await this.list(workspaceId)) {
      const account = connection.config.accounts.find(item => item.walletId === walletId);
      if (account) return { connectionId: connection.id, accountId: account.id };
    }
    return null;
  }

  // --- shared with the pull service ---

  async require(workspaceId: string, connectionId: string) {
    const integration = await this.integrationRepository.findOne({
      where: { id: connectionId, workspaceId },
      relations: ['openProtocolSettings'],
    });
    if (!integration?.openProtocolSettings) {
      throw new NotFoundException('Bank-sync connection not found');
    }
    if (integration.status === IntegrationStatus.DISCONNECTED) {
      throw new BadRequestException('This connection is disconnected');
    }
    return { integration, settings: integration.openProtocolSettings };
  }

  providerOf(key: string): BankSyncProvider {
    const provider = this.providers.find(item => item.key === key);
    if (!provider) throw new BadRequestException(`Unknown bank-sync provider "${key}"`);
    return provider;
  }

  configOf(integration: Integration): BankSyncConnectionConfig {
    return normalizeConfig(integration.openProtocolSettings?.config, integration.provider);
  }

  secretsOf(integration: Integration): Record<string, string> {
    const stored = integration.openProtocolSettings?.encryptedSecrets ?? {};
    const entries = Object.entries(stored);
    if (entries.length === 0) throw new BadRequestException('This connection has no credentials');
    return Object.fromEntries(entries.map(([key, value]) => [key, decryptText(value)]));
  }

  async saveConfig(
    settings: OpenProtocolSettings,
    config: BankSyncConnectionConfig,
  ): Promise<void> {
    settings.config = config as unknown as Record<string, unknown>;
    await this.settingsRepository.save(settings);
  }

  present(integration: Integration): BankSyncConnection {
    const config = this.configOf(integration);
    return {
      id: integration.id,
      provider: integration.provider,
      linkStyle: this.providerOf(integration.provider).linkStyle,
      label: config.label || integration.provider,
      status: integration.status,
      config,
    };
  }

  // --- internals ---

  private tokenProvider(key: string): TokenBankSyncProvider {
    const provider = this.providerOf(key);
    if (isRedirectProvider(provider)) {
      throw new BadRequestException(`${key} is authorized in the browser, not with a token`);
    }
    return provider;
  }

  private redirectProvider(key: string): RedirectBankSyncProvider {
    const provider = this.providerOf(key);
    if (!isRedirectProvider(provider)) {
      throw new BadRequestException(`${key} is connected with a setup token, not in the browser`);
    }
    return provider;
  }

  private encryptSecrets(secrets: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(secrets).map(([key, value]) => [key, encryptText(value)]),
    );
  }

  private async createIntegration(
    user: User,
    workspaceId: string,
    providerKey: string,
  ): Promise<Integration> {
    const integration = this.integrationRepository.create({
      workspaceId,
      provider: providerKey as Integration['provider'],
      // Several connections to one provider are normal here, so each gets its
      // own instance key; NULL would mean "the only one" and collide.
      instanceKey: randomUUID(),
      scopes: [],
      status: IntegrationStatus.CONNECTED,
      connectedByUserId: user.id,
    });
    return this.integrationRepository.save(integration);
  }

  private async persist(
    integration: Integration,
    config: BankSyncConnectionConfig,
    secrets: Record<string, string>,
  ): Promise<void> {
    const settings =
      integration.openProtocolSettings ??
      this.settingsRepository.create({ integrationId: integration.id, lastSyncAt: null });
    settings.config = config as unknown as Record<string, unknown>;
    settings.encryptedSecrets = secrets;
    await this.settingsRepository.save(settings);
  }

  private async reload(connectionId: string): Promise<Integration> {
    const integration = await this.integrationRepository.findOne({
      where: { id: connectionId },
      relations: ['openProtocolSettings'],
    });
    if (!integration) throw new NotFoundException('Bank-sync connection not found');
    return integration;
  }

  private async requireWallet(workspaceId: string, walletId: string): Promise<void> {
    const wallet = await this.walletRepository.findOne({
      where: { workspaceId, id: walletId },
      select: ['id'],
    });
    if (!wallet) throw new BadRequestException('Wallet does not belong to this workspace');
  }

  private async requireWalletFree(
    workspaceId: string,
    walletId: string,
    connectionId: string,
    accountId: string,
  ): Promise<void> {
    const feed = await this.feedOf(workspaceId, walletId);
    if (feed && !(feed.connectionId === connectionId && feed.accountId === accountId)) {
      throw new BadRequestException(
        'That wallet already has a bank feed: switch it instead of adding a second one',
      );
    }
  }

  private async lastTransactionDate(workspaceId: string, walletId: string): Promise<Date | null> {
    const row = await this.transactionRepository.findOne({
      where: { workspaceId, walletId },
      order: { transactionDate: 'DESC' },
      select: ['transactionDate'],
    });
    return row?.transactionDate ? new Date(row.transactionDate) : null;
  }
}
