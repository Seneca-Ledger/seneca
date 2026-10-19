import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { APP_NAME } from '../../../common/brand';
import {
  OAuthIntegrationBaseService,
  type OAuthIntegrationSettingsRelationName,
} from '../../../common/services/oauth-integration-base.service';
import { decryptText, encryptText } from '../../../common/utils/encryption.util';
import { requireSecret } from '../../../common/utils/required-secret.util';
import {
  GmailSettings,
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationToken,
  User,
  WorkspaceMember,
} from '../../../entities';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.compose',
];

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

@Injectable()
export class GmailOAuthService extends OAuthIntegrationBaseService {
  protected readonly logger = new Logger(GmailOAuthService.name);

  constructor(
    @InjectRepository(Integration)
    integrationRepository: Repository<Integration>,
    @InjectRepository(IntegrationToken)
    integrationTokenRepository: Repository<IntegrationToken>,
    @InjectRepository(GmailSettings)
    private readonly gmailSettingsRepository: Repository<GmailSettings>,
    @InjectRepository(User)
    userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    workspaceMemberRepository: Repository<WorkspaceMember>,
  ) {
    super(
      integrationRepository,
      integrationTokenRepository,
      userRepository,
      workspaceMemberRepository,
    );
  }

  protected getProvider(): IntegrationProvider {
    return IntegrationProvider.GMAIL;
  }

  protected getProviderName(): string {
    return 'Gmail';
  }

  protected getProviderRouteSegment(): string {
    return 'gmail';
  }

  protected getSettingsRelationName(): OAuthIntegrationSettingsRelationName {
    return 'gmailSettings';
  }

  private getClientId() {
    return process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  }

  private getClientSecret() {
    return process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  }

  private getRedirectUri() {
    return process.env.GMAIL_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || '';
  }

  protected getFrontendBaseUrl() {
    return process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
  }

  protected getStateSecret() {
    return requireSecret(
      'GMAIL_STATE_SECRET or JWT_SECRET',
      process.env.GMAIL_STATE_SECRET,
      process.env.JWT_SECRET,
    );
  }

  private getOAuthConfig() {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = this.getRedirectUri();
    if (!(clientId && clientSecret && redirectUri)) {
      throw new BadRequestException('Gmail OAuth is not configured');
    }
    return { clientId, clientSecret, redirectUri };
  }

  private async requestToken(params: Record<string, string>): Promise<GoogleTokenResponse> {
    const { clientId, clientSecret, redirectUri } = this.getOAuthConfig();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        ...params,
      }),
    });
    if (!response.ok) {
      throw new Error(`Google OAuth token request failed with status ${response.status}`);
    }
    return (await response.json()) as GoogleTokenResponse;
  }

  override findWorkspaceIntegration(workspaceId: string) {
    return super.findWorkspaceIntegration(workspaceId);
  }

  override ensureWorkspaceIntegration(workspaceId: string) {
    return super.ensureWorkspaceIntegration(workspaceId);
  }

  /** The integration is bound to `workspaceId`, the workspace the user connects from. */
  getAuthUrl(user: User, workspaceId: string): string {
    const { clientId, redirectUri } = this.getOAuthConfig();
    const state = this.buildState({
      userId: user.id,
      workspaceId,
      redirect: `${this.getFrontendBaseUrl()}/integrations/gmail`,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: GMAIL_SCOPES.join(' '),
      state,
    }).toString()}`;
  }

  async handleCallback(params: {
    code?: string;
    state?: string;
    error?: string;
  }): Promise<{ redirectUrl: string; integration?: Integration }> {
    const redirectBase = `${this.getFrontendBaseUrl()}/integrations/gmail`;

    if (params.error) {
      return {
        redirectUrl: `${redirectBase}?status=error&reason=${encodeURIComponent(params.error)}`,
      };
    }

    if (!(params.code && params.state)) {
      return { redirectUrl: `${redirectBase}?status=error&reason=missing_code` };
    }

    let state: Record<string, unknown>;
    try {
      state = this.parseState(params.state);
    } catch (_error) {
      return { redirectUrl: `${redirectBase}?status=error&reason=bad_state` };
    }

    const userId = typeof state.userId === 'string' ? state.userId : null;
    if (!userId) {
      return { redirectUrl: `${redirectBase}?status=error&reason=missing_user` };
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id'],
    });

    if (!user) {
      return { redirectUrl: `${redirectBase}?status=error&reason=user_not_found` };
    }

    const workspaceId = await this.resolveStateWorkspaceId(state, user.id);
    if (!workspaceId) {
      return { redirectUrl: `${redirectBase}?status=error&reason=workspace_forbidden` };
    }

    const tokens = await this.requestToken({
      grant_type: 'authorization_code',
      code: params.code,
    });
    const accessToken = tokens.access_token || '';
    const refreshToken = tokens.refresh_token || '';

    if (!(accessToken || refreshToken)) {
      return { redirectUrl: `${redirectBase}?status=error&reason=missing_tokens` };
    }

    const existing = await this.integrationRepository.findOne({
      where: { workspaceId, provider: IntegrationProvider.GMAIL },
      relations: ['token', 'gmailSettings'],
    });

    const integration =
      existing ||
      this.integrationRepository.create({
        provider: IntegrationProvider.GMAIL,
        workspaceId,
        connectedByUserId: user.id,
      });

    integration.status = IntegrationStatus.CONNECTED;
    integration.scopes = tokens.scope
      ? tokens.scope.split(' ')
      : integration.scopes || GMAIL_SCOPES;
    integration.connectedByUserId = user.id;

    const savedIntegration = await this.integrationRepository.save(integration);

    const tokenRecord =
      existing?.token ||
      this.integrationTokenRepository.create({
        integrationId: savedIntegration.id,
      });

    if (accessToken) {
      tokenRecord.encryptedAccessToken = encryptText(accessToken);
      tokenRecord.accessToken = null;
    }
    if (refreshToken) {
      tokenRecord.encryptedRefreshToken = encryptText(refreshToken);
      tokenRecord.refreshToken = null;
    }
    if (tokens.expires_in) {
      tokenRecord.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    }

    await this.integrationTokenRepository.save(tokenRecord);

    // Create or update Gmail settings
    const settings =
      existing?.gmailSettings ||
      this.gmailSettingsRepository.create({
        integrationId: savedIntegration.id,
        labelName: `${APP_NAME}/Receipts`,
        filterEnabled: true,
        filterConfig: {
          hasAttachment: true,
          keywords: ['receipt', 'invoice', 'order confirmation'],
        },
      });

    await this.gmailSettingsRepository.save(settings);

    return {
      redirectUrl: `${redirectBase}?status=success`,
      integration: savedIntegration,
    };
  }

  protected async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt?: Date }> {
    const credentials = await this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    return {
      accessToken: credentials.access_token || '',
      expiresAt: credentials.expires_in
        ? new Date(Date.now() + credentials.expires_in * 1000)
        : undefined,
    };
  }

  protected getAuthorizationExpiredMessage(): string {
    return 'Failed to refresh access token';
  }

  private async refreshAccessTokenForIntegration(integration: Integration): Promise<string> {
    const tokenRecord = await this.integrationTokenRepository.findOne({
      where: { integrationId: integration.id },
    });

    if (!(tokenRecord?.encryptedRefreshToken || tokenRecord?.refreshToken)) {
      throw new BadRequestException('No refresh token available');
    }

    let refreshToken: string;
    if (tokenRecord.encryptedRefreshToken) {
      refreshToken = decryptText(tokenRecord.encryptedRefreshToken);
    } else if (tokenRecord.refreshToken) {
      refreshToken = tokenRecord.refreshToken;
      tokenRecord.encryptedRefreshToken = encryptText(refreshToken);
      tokenRecord.refreshToken = null;
    } else {
      throw new BadRequestException('No refresh token available');
    }

    try {
      const refreshed = await this.refreshAccessToken(refreshToken);

      if (refreshed.accessToken) {
        tokenRecord.encryptedAccessToken = encryptText(refreshed.accessToken);
        tokenRecord.accessToken = null;
      }
      if (refreshed.expiresAt) {
        tokenRecord.expiresAt = refreshed.expiresAt;
      }

      await this.integrationTokenRepository.save(tokenRecord);

      if (integration.status !== IntegrationStatus.CONNECTED) {
        integration.status = IntegrationStatus.CONNECTED;
        await this.integrationRepository.save(integration);
      }

      return refreshed.accessToken;
    } catch (error) {
      this.logger.error('Failed to refresh Gmail access token', error);
      integration.status = IntegrationStatus.NEEDS_REAUTH;
      await this.integrationRepository.save(integration);
      throw new BadRequestException('Failed to refresh access token');
    }
  }

  async getGmailClient(workspaceId: string) {
    const integration = await this.ensureWorkspaceIntegration(workspaceId);

    // If the integration is already marked as needing re-auth, fail fast
    if (integration.status === IntegrationStatus.NEEDS_REAUTH) {
      throw new BadRequestException('Integration needs re-authentication');
    }

    const tokenRecord = await this.integrationTokenRepository.findOne({
      where: { integrationId: integration.id },
    });

    // Fallback to plain accessToken if encrypted version doesn't exist
    if (!(tokenRecord?.encryptedAccessToken || tokenRecord?.accessToken)) {
      throw new BadRequestException('No access token available');
    }

    let accessToken: string;
    if (tokenRecord.encryptedAccessToken) {
      accessToken = decryptText(tokenRecord.encryptedAccessToken);
    } else if (tokenRecord.accessToken) {
      // Migrate plain token to encrypted
      accessToken = tokenRecord.accessToken;
      tokenRecord.encryptedAccessToken = encryptText(accessToken);
      tokenRecord.accessToken = null;
      await this.integrationTokenRepository.save(tokenRecord);
    } else {
      throw new BadRequestException('No access token available');
    }

    // Check if token is expired
    if (tokenRecord.expiresAt && new Date() >= tokenRecord.expiresAt) {
      accessToken = await this.refreshAccessTokenForIntegration(integration);
    }

    return { accessToken, integration };
  }

  async disconnect(workspaceId: string): Promise<void> {
    const integration = await this.ensureWorkspaceIntegration(workspaceId);

    // Delete token
    await this.integrationTokenRepository.delete({ integrationId: integration.id });

    // Delete settings
    await this.gmailSettingsRepository.delete({ integrationId: integration.id });

    // Update integration status
    integration.status = IntegrationStatus.DISCONNECTED;
    await this.integrationRepository.save(integration);
  }
}
