import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationToken,
  User,
  WorkspaceMember,
  WorkspaceRole,
} from '../../entities';
import { decryptText, encryptText } from '../utils/encryption.util';
import { secretsMatch } from '../utils/secret-compare.util';

// Method syntax on purpose: method parameters are checked bivariantly, so a
// TypeORM Repository (whose methods take narrower option types) fits.
export type OAuthRepositoryLike<T> = {
  findOne(args: unknown): Promise<T | null>;
  create(data: Partial<T>): T;
  save(entity: T): Promise<T>;
  delete(criteria: unknown): Promise<unknown>;
};

export type OAuthIntegrationSettingsRelationName = Exclude<keyof Integration, number | symbol>;

export abstract class OAuthIntegrationBaseService {
  protected abstract readonly logger: {
    error(message: string, error?: unknown): void;
    warn(message: string): void;
  };

  constructor(
    protected readonly integrationRepository: OAuthRepositoryLike<Integration>,
    protected readonly integrationTokenRepository: OAuthRepositoryLike<IntegrationToken>,
    protected readonly userRepository: OAuthRepositoryLike<User>,
    protected readonly workspaceMemberRepository?: OAuthRepositoryLike<WorkspaceMember>,
  ) {}

  protected abstract getProvider(): IntegrationProvider;

  protected abstract getProviderName(): string;

  protected abstract getProviderRouteSegment(): string;

  protected abstract getFrontendBaseUrl(): string;

  protected abstract getSettingsRelationName(): OAuthIntegrationSettingsRelationName;

  protected abstract getStateSecret(): string;

  protected abstract refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt?: Date }>;

  protected abstract getAuthorizationExpiredMessage(): string;

  protected buildState(payload: Record<string, unknown>): string {
    const encoded = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.signState(encoded);
    return `${encoded}.${signature}`;
  }

  protected parseState(state: string): Record<string, unknown> {
    const [encoded, signature] = (state || '').split('.');
    if (!(encoded && signature)) {
      throw new BadRequestException('Invalid OAuth state');
    }

    const expected = this.signState(encoded);
    if (!secretsMatch(signature, expected)) {
      throw new BadRequestException('Invalid OAuth state signature');
    }

    return JSON.parse(this.base64UrlDecode(encoded));
  }

  /** A workspace has at most one integration per provider (UQ_integrations_workspace_provider). */
  protected findWorkspaceIntegration(workspaceId: string): Promise<Integration | null> {
    return this.integrationRepository.findOne({
      where: { workspaceId, provider: this.getProvider() },
      relations: ['token', this.getSettingsRelationName()],
    });
  }

  protected async ensureWorkspaceIntegration(workspaceId: string): Promise<Integration> {
    const integration = await this.findWorkspaceIntegration(workspaceId);
    if (!integration) {
      throw new NotFoundException(`${this.getProviderName()} integration not found`);
    }

    return integration;
  }

  /**
   * The workspace an OAuth callback connects: the one the signed state carries,
   * as long as the user still manages that workspace's integrations. The
   * provider redirects back without the workspace header, so the state is the
   * only record of where the connection was started.
   */
  protected async resolveStateWorkspaceId(
    state: Record<string, unknown>,
    userId: string,
  ): Promise<string | null> {
    const workspaceId = typeof state.workspaceId === 'string' ? state.workspaceId : null;
    if (!(workspaceId && this.workspaceMemberRepository)) {
      return null;
    }

    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
    });
    const canManage =
      membership && [WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(membership.role);
    return canManage ? workspaceId : null;
  }

  protected async ensureValidAccessToken(integration: Integration): Promise<string> {
    if (!integration.token) {
      throw new BadRequestException('Integration token missing');
    }

    const refreshToken = decryptText(integration.token.refreshToken || '');
    let accessToken = decryptText(integration.token.accessToken || '');
    const expiresAt = integration.token.expiresAt?.getTime() || 0;
    const shouldRefresh = !accessToken || (expiresAt && expiresAt <= Date.now() + 60 * 1000);
    if (!shouldRefresh) {
      return accessToken;
    }

    try {
      const refreshed = await this.refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      integration.token.accessToken = encryptText(accessToken);
      if (refreshed.expiresAt) {
        integration.token.expiresAt = refreshed.expiresAt;
      }
      await this.integrationTokenRepository.save(integration.token);
      return accessToken;
    } catch {
      integration.status = IntegrationStatus.NEEDS_REAUTH;
      await this.integrationRepository.save(integration);
      throw new BadRequestException(this.getAuthorizationExpiredMessage());
    }
  }

  /** The integration is bound to `workspaceId`, the workspace the user connects from. */
  protected buildProviderAuthUrl(
    user: Pick<User, 'id'>,
    workspaceId: string,
    buildUrl: (state: string) => string,
  ): string {
    const state = this.buildState({
      userId: user.id,
      workspaceId,
      redirect: `${this.getFrontendBaseUrl()}/integrations/${this.getProviderRouteSegment()}`,
    });

    return buildUrl(state);
  }

  protected buildIntegrationRedirect(status: string, reason?: string): string {
    const base = `${this.getFrontendBaseUrl()}/integrations/${this.getProviderRouteSegment()}`;
    if (!reason) {
      return `${base}?status=${status}`;
    }

    return `${base}?status=${status}&reason=${encodeURIComponent(reason)}`;
  }

  protected async resolveOAuthCallbackUser<TUser extends Pick<User, 'id'>>(
    params: { code?: string; state?: string; error?: string },
    select: Array<keyof User>,
  ): Promise<
    | { redirectBase: string; user: TUser; workspaceId: string }
    | {
        redirectUrl: string;
        code?: undefined;
        user?: undefined;
        redirectBase?: undefined;
        workspaceId?: undefined;
      }
  > {
    const redirectBase = `${this.getFrontendBaseUrl()}/integrations/${this.getProviderRouteSegment()}`;

    if (params.error) {
      return { redirectUrl: this.buildIntegrationRedirect('error', params.error) };
    }

    if (!(params.code && params.state)) {
      return { redirectUrl: this.buildIntegrationRedirect('error', 'missing_code') };
    }

    let state: Record<string, unknown>;
    try {
      state = this.parseState(params.state);
    } catch {
      return { redirectUrl: this.buildIntegrationRedirect('error', 'bad_state') };
    }

    const userId = typeof state.userId === 'string' ? state.userId : null;
    if (!userId) {
      return { redirectUrl: this.buildIntegrationRedirect('error', 'missing_user') };
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select,
    });

    if (!user) {
      return { redirectUrl: this.buildIntegrationRedirect('error', 'user_not_found') };
    }

    const workspaceId = await this.resolveStateWorkspaceId(state, userId);
    if (!workspaceId) {
      return { redirectUrl: this.buildIntegrationRedirect('error', 'workspace_forbidden') };
    }

    return { redirectBase, user: user as unknown as TUser, workspaceId };
  }

  protected async upsertConnectedIntegration(
    existing: Integration | null,
    user: Pick<User, 'id'>,
    workspaceId: string,
    scopes: string[],
  ): Promise<Integration> {
    const integration =
      existing ||
      this.integrationRepository.create?.({
        provider: this.getProvider(),
        workspaceId,
        connectedByUserId: user.id,
      }) ||
      ({
        provider: this.getProvider(),
        workspaceId,
        connectedByUserId: user.id,
      } as Integration);

    integration.status = IntegrationStatus.CONNECTED;
    integration.scopes = scopes;
    integration.connectedByUserId = user.id;

    return this.integrationRepository.save(integration);
  }

  protected async saveEncryptedTokenRecord(
    existingToken: IntegrationToken | null | undefined,
    integrationId: string,
    tokens: { accessToken?: string; refreshToken?: string; expiresAt?: Date },
  ): Promise<IntegrationToken> {
    const tokenRecord =
      existingToken ||
      this.integrationTokenRepository.create?.({
        integrationId,
        accessToken: '',
        refreshToken: '',
      }) ||
      ({ integrationId, accessToken: '', refreshToken: '' } as IntegrationToken);

    if (tokens.accessToken) {
      tokenRecord.accessToken = encryptText(tokens.accessToken);
    }
    if (tokens.refreshToken) {
      tokenRecord.refreshToken = encryptText(tokens.refreshToken);
    }
    if (tokens.expiresAt) {
      tokenRecord.expiresAt = tokens.expiresAt;
    }

    await this.integrationTokenRepository.save(tokenRecord);
    return tokenRecord;
  }

  private base64UrlEncode(value: string): string {
    return Buffer.from(value)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private base64UrlDecode(value: string): string {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  private signState(payload: string): string {
    const hmac = crypto.createHmac('sha256', this.getStateSecret());
    hmac.update(payload);
    return hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
}
