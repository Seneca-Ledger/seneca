import { Agent as HttpsAgent } from 'node:https';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PushService } from '@/modules/push/push.service';

jest.mock('../../../../src/common/utils/egress-url.util', () => {
  const actual = jest.requireActual('../../../../src/common/utils/egress-url.util');
  return {
    ...actual,
    // Fixture push hosts resolve to a public address; IP literals are checked for real.
    assertPublicEgressUrl: jest.fn((url: string) =>
      actual.assertPublicEgressUrl(url, { lookup: async () => [{ address: '142.250.102.95' }] }),
    ),
  };
});

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

  it('keeps the keys of a device that re-subscribes fresh', async () => {
    env.WEB_PUSH_VAPID_PUBLIC_KEY = 'pub';
    env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv';
    repository.findOne.mockResolvedValue({
      id: 'old',
      endpoint: 'https://push.example/x',
      userId: 'u1',
      p256dh: 'p1',
      auth: 'a1',
    });

    const saved = await service.subscribe('u1', {
      endpoint: 'https://push.example/x',
      keys: { p256dh: 'p2', auth: 'a2' },
      userAgent: 'Phone',
    });

    expect(repository.create).not.toHaveBeenCalled();
    expect(saved).toMatchObject({ userId: 'u1', p256dh: 'p2', auth: 'a2', userAgent: 'Phone' });
  });

  it('moves a device that changed hands, which presents the subscription keys', async () => {
    env.WEB_PUSH_VAPID_PUBLIC_KEY = 'pub';
    env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv';
    repository.findOne.mockResolvedValue({
      id: 'old',
      endpoint: 'https://push.example/x',
      userId: 'u0',
      p256dh: 'p1',
      auth: 'a1',
    });

    const saved = await service.subscribe('u1', {
      endpoint: 'https://push.example/x',
      keys: { p256dh: 'p1', auth: 'a1' },
    });

    expect(saved).toMatchObject({ id: 'old', userId: 'u1' });
  });

  // Knowing another user's endpoint URL is not enough to take their device's
  // subscription over (and break it with keys it cannot decrypt for).
  it("refuses another user's endpoint with different keys", async () => {
    env.WEB_PUSH_VAPID_PUBLIC_KEY = 'pub';
    env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv';
    repository.findOne.mockResolvedValue({
      id: 'old',
      endpoint: 'https://push.example/x',
      userId: 'u0',
      p256dh: 'p1',
      auth: 'a1',
    });

    await expect(
      service.subscribe('u1', {
        endpoint: 'https://push.example/x',
        keys: { p256dh: 'attacker', auth: 'attacker' },
      }),
    ).rejects.toThrow(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  // The server POSTs to the endpoint on every notification (blind SSRF).
  it.each([
    'https://10.0.0.5:8443/admin',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/x',
    'https://localhost/x',
  ])('refuses an endpoint inside the network: %s', async endpoint => {
    env.WEB_PUSH_VAPID_PUBLIC_KEY = 'pub';
    env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv';
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.subscribe('u1', { endpoint, keys: { p256dh: 'p', auth: 'a' } }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it.each([
    'https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91b',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk',
    'https://web.push.apple.com/QGv2ZcD3',
    'https://wns2-par02p.notify.windows.com/w/?token=BQYAAA',
  ])('accepts a push service endpoint: %s', async endpoint => {
    env.WEB_PUSH_VAPID_PUBLIC_KEY = 'pub';
    env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv';
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.subscribe('u1', { endpoint, keys: { p256dh: 'p', auth: 'a' } }),
    ).resolves.toMatchObject({ endpoint, userId: 'u1' });
  });

  it('pushes through an agent that re-checks addresses and skips stored private endpoints', async () => {
    env.WEB_PUSH_VAPID_PUBLIC_KEY = 'pub';
    env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv';
    repository.find.mockResolvedValue([
      { id: 'legacy', endpoint: 'https://10.0.0.5/admin', p256dh: 'p', auth: 'a' },
      { id: 's1', endpoint: 'https://fcm.googleapis.com/fcm/send/x', p256dh: 'p', auth: 'a' },
    ]);
    mockSendNotification.mockResolvedValue({ statusCode: 201, body: '' });

    await expect(service.sendToUser('u1', { title: 't', body: 'b' })).resolves.toBe(true);

    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotification.mock.calls[0][0].endpoint).toBe(
      'https://fcm.googleapis.com/fcm/send/x',
    );
    expect(mockSendNotification.mock.calls[0][2].agent).toBeInstanceOf(HttpsAgent);
    // A check failure is not the push service saying the device is gone.
    expect(repository.delete).not.toHaveBeenCalled();
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
