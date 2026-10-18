import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { WebhookTokenGuard } from '../../../../src/modules/webhooks/guards/webhook-token.guard';

describe('WebhookTokenGuard', () => {
  let guard: WebhookTokenGuard;
  const mockEndpointsService = { findByToken: jest.fn() };
  const mockPlugins = { assertEnabled: jest.fn() };

  beforeEach(() => {
    guard = new WebhookTokenGuard(mockEndpointsService as any, mockPlugins as any);
    jest.clearAllMocks();
    mockPlugins.assertEnabled.mockResolvedValue(undefined);
  });

  it('should allow valid active token', async () => {
    const endpoint = { id: 'ep-1', isActive: true, workspaceId: 'ws-1' };
    mockEndpointsService.findByToken.mockResolvedValue(endpoint);
    const req: any = { params: { token: 'validtoken' } };
    const ctx: any = { switchToHttp: () => ({ getRequest: () => req }) };
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.webhookEndpoint).toBe(endpoint);
    expect(mockPlugins.assertEnabled).toHaveBeenCalledWith('ws-1', 'webhooks');
  });

  it('should refuse a valid token while the workspace has webhooks off', async () => {
    mockEndpointsService.findByToken.mockResolvedValue({ id: 'ep-1', workspaceId: 'ws-1' });
    mockPlugins.assertEnabled.mockRejectedValue(new ForbiddenException('off'));
    const req: any = { params: { token: 'validtoken' } };
    const ctx: any = { switchToHttp: () => ({ getRequest: () => req }) };
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(req.webhookEndpoint).toBeUndefined();
  });

  it('should throw for missing token', async () => {
    const ctx: any = { switchToHttp: () => ({ getRequest: () => ({ params: {} }) }) };
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw for unknown token', async () => {
    mockEndpointsService.findByToken.mockResolvedValue(null);
    const ctx: any = { switchToHttp: () => ({ getRequest: () => ({ params: { token: 'bad' } }) }) };
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
