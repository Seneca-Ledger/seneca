import { ConflictException } from '@nestjs/common';
import { PushService } from '@/modules/push/push.service';

const mockSendNotification = jest.fn();
jest.mock("web-push", () => ({ setVapidDetails: jest.fn(), sendNotification: mockSendNotification }), { virtual: true });

describe('PushService', () => {
  const repository = {
    findOne: jest.fn(),
    create: jest.fn((data: unknown) => data),
    save: jest.fn(async (data: unknown) => ({ id: 'sub-1', ...(data as object) })),
    find: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };
  const env: Record<string, string> = {};
  const configService = { get: (key: string) => env[key] };
  let service: PushService;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(env)) delete env[key];
    service = new PushService(repository as any, configService as any);
  });

  it('is off without VAPID keys and refuses subscriptions', async () => {
    expect(service.isEnabled()).toBe(false);
    await expect(
      service.subscribe('u1', { endpoint: 'https://push.example/x', keys: { p256dh: 'p', auth: 'a' } }),
    ).rejects.toThrow(ConflictException);
    expect(await service.sendToUser('u1', { title: 't', body: 'b' })).toBe(false);
  });

  it('moves an endpoint that re-subscribes and keeps the keys fresh', async () => {
    env.WEB_PUSH_VAPID_PUBLIC_KEY = 'pub';
    env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv';
    repository.findOne.mockResolvedValue({ id: 'old', endpoint: 'https://push.example/x', userId: 'u0' });

    const saved = await service.subscribe('u1', {
      endpoint: 'https://push.example/x',
      keys: { p256dh: 'p2', auth: 'a2' },
      userAgent: 'Phone',
    });

    expect(repository.create).not.toHaveBeenCalled();
    expect(saved).toMatchObject({ userId: 'u1', p256dh: 'p2', auth: 'a2', userAgent: 'Phone' });
  });

  it('sends to every device and drops the ones the push service says are gone', async () => {
    env.WEB_PUSH_VAPID_PUBLIC_KEY = 'pub';
    env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv';
    repository.find.mockResolvedValue([
      { id: 's1', endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' },
      { id: 's2', endpoint: 'https://push.example/2', p256dh: 'p', auth: 'a' },
    ]);
    mockSendNotification
      .mockResolvedValueOnce({ statusCode: 201, body: '' })
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));

    const ok = await service.sendToUser('u1', { title: 'Budget', body: 'Food at 90%', url: '/budgets' });

    expect(ok).toBe(true);
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mockSendNotification.mock.calls[0][1])).toMatchObject({ title: 'Budget', url: '/budgets' });
    expect(repository.delete).toHaveBeenCalledWith('s2');
    expect(repository.update).toHaveBeenCalledWith('s1', expect.objectContaining({ lastUsedAt: expect.any(Date) }));
  });

  it('is nothing to retry when the user has no devices', async () => {
    env.WEB_PUSH_VAPID_PUBLIC_KEY = 'pub';
    env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv';
    repository.find.mockResolvedValue([]);
    expect(await service.sendToUser('u1', { title: 't', body: 'b' })).toBe(true);
  });
});
