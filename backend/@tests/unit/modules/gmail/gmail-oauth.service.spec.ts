import { OAuthIntegrationBaseService } from '@/common/services/oauth-integration-base.service';
import type { GmailSettings } from '@/entities/gmail-settings.entity';
import type { IntegrationToken } from '@/entities/integration-token.entity';
import {
  type Integration,
  IntegrationProvider,
  IntegrationStatus,
} from '@/entities/integration.entity';
import type { User } from '@/entities/user.entity';
import { type WorkspaceMember, WorkspaceRole } from '@/entities/workspace-member.entity';
import { GmailOAuthService } from '@/modules/gmail/services/gmail-oauth.service';
import { decryptText } from '@/common/utils/encryption.util';

type RepoMock<T> = {
  findOne: jest.Mock<Promise<T | null>, [unknown]>;
  save: jest.Mock<Promise<T>, [Partial<T>]>;
  create: jest.Mock<T, [Partial<T>]>;
  delete: jest.Mock<Promise<unknown>, [unknown]>;
};

function createRepoMock<T>(): RepoMock<T> {
  return {
    findOne: jest.fn(),
    save: jest.fn(async (data: Partial<T>) => data as T),
    create: jest.fn((data: Partial<T>) => data as T),
    delete: jest.fn(),
  };
}

describe('GmailOAuthService', () => {
  const integrationRepository = createRepoMock<Integration>();
  const integrationTokenRepository = createRepoMock<IntegrationToken>();
  const gmailSettingsRepository = createRepoMock<GmailSettings>();
  const userRepository = createRepoMock<User>();
  const workspaceMemberRepository = createRepoMock<WorkspaceMember>();

  let service: GmailOAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GMAIL_CLIENT_ID = 'gmail-client-id';
    process.env.GMAIL_CLIENT_SECRET = 'gmail-client-secret';
    process.env.GMAIL_REDIRECT_URI = 'https://app.example.com/api/gmail/callback';
    process.env.FRONTEND_URL = 'https://app.example.com';

    service = new GmailOAuthService(
      integrationRepository,
      integrationTokenRepository,
      gmailSettingsRepository,
      userRepository,
      workspaceMemberRepository,
    );
  });

  it('reuses signed state helpers when building the auth url', () => {
    expect(service).toBeInstanceOf(OAuthIntegrationBaseService);

    const url = service.getAuthUrl({ id: 'user-1', workspaceId: 'ws-1' } as unknown as User, 'ws-1');

    expect(url).toContain('state=');
    expect(url).toContain('access_type=offline');
  });

  it('carries the workspace the user connects from, not the one they registered with', () => {
    const url = service.getAuthUrl(
      { id: 'user-1', workspaceId: 'ws-home' } as unknown as User,
      'ws-open',
    );

    const state = new URL(url).searchParams.get('state');
    expect((service as any).parseState(state)).toMatchObject({
      userId: 'user-1',
      workspaceId: 'ws-open',
    });
  });

  it('disconnects gmail integration and clears token plus settings', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'user-1', workspaceId: 'ws-1' });
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.GMAIL,
      status: IntegrationStatus.CONNECTED,
      token: { integrationId: 'integration-1' },
      gmailSettings: { integrationId: 'integration-1' },
    });

    await service.disconnect('ws-1');

    expect(integrationRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'ws-1', provider: IntegrationProvider.GMAIL } }),
    );
    expect(integrationTokenRepository.delete).toHaveBeenCalledWith({
      integrationId: 'integration-1',
    });
    expect(gmailSettingsRepository.delete).toHaveBeenCalledWith({ integrationId: 'integration-1' });
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'integration-1',
        status: IntegrationStatus.DISCONNECTED,
      }),
    );
  });

  it('stores Gmail callback tokens only in encrypted fields', async () => {
    const state = (service as any).buildState({ userId: 'user-1', workspaceId: 'ws-1' });
    userRepository.findOne.mockResolvedValue({ id: 'user-1', workspaceId: 'ws-1' });
    workspaceMemberRepository.findOne.mockResolvedValue({ role: WorkspaceRole.OWNER });
    integrationRepository.findOne.mockResolvedValue(null);
    integrationRepository.create.mockReturnValue({
      id: 'integration-1',
      provider: IntegrationProvider.GMAIL,
      status: IntegrationStatus.DISCONNECTED,
    } as Integration);
    integrationRepository.save.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.GMAIL,
      status: IntegrationStatus.CONNECTED,
    } as Integration);
    (service as any).requestToken = jest.fn(async () => ({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
    }));

    await service.handleCallback({ code: 'code-1', state });

    const savedToken = integrationTokenRepository.save.mock.calls[0][0];
    expect(savedToken.accessToken).toBeNull();
    expect(savedToken.refreshToken).toBeNull();
    expect(savedToken.encryptedAccessToken).toMatch(/^enc:/);
    expect(savedToken.encryptedRefreshToken).toMatch(/^enc:/);
    expect(decryptText(savedToken.encryptedAccessToken!)).toBe('access-1');
    expect(decryptText(savedToken.encryptedRefreshToken!)).toBe('refresh-1');
  });

  it('connects the workspace the state carries', async () => {
    const state = (service as any).buildState({ userId: 'user-1', workspaceId: 'ws-open' });
    userRepository.findOne.mockResolvedValue({ id: 'user-1', workspaceId: 'ws-home' });
    workspaceMemberRepository.findOne.mockResolvedValue({ role: WorkspaceRole.ADMIN });
    integrationRepository.findOne.mockResolvedValue(null);
    integrationRepository.save.mockImplementation(async data => data as Integration);
    (service as any).requestToken = jest.fn(async () => ({ access_token: 'access-1' }));

    const result = await service.handleCallback({ code: 'code-1', state });

    expect(result.redirectUrl).toContain('status=success');
    expect(workspaceMemberRepository.findOne).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-open', userId: 'user-1' },
    });
    expect(integrationRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'ws-open', provider: IntegrationProvider.GMAIL },
      }),
    );
    expect(integrationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-open', connectedByUserId: 'user-1' }),
    );
  });

  it.each([
    ['a plain member of the workspace', { role: WorkspaceRole.MEMBER }, 'ws-open'],
    ['no longer a member', null, 'ws-open'],
    ['a state without a workspace', { role: WorkspaceRole.OWNER }, undefined],
  ])('refuses the callback for %s', async (_case, membership, workspaceId) => {
    const state = (service as any).buildState({ userId: 'user-1', workspaceId });
    userRepository.findOne.mockResolvedValue({ id: 'user-1' });
    workspaceMemberRepository.findOne.mockResolvedValue(membership);
    const requestToken = jest.fn();
    (service as any).requestToken = requestToken;

    const result = await service.handleCallback({ code: 'code-1', state });

    expect(result.redirectUrl).toContain('reason=workspace_forbidden');
    expect(requestToken).not.toHaveBeenCalled();
    expect(integrationRepository.save).not.toHaveBeenCalled();
  });
});
