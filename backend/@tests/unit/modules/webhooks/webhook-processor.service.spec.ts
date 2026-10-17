import type { Mock } from 'vitest';
import { createHmac } from 'node:crypto';
import { WebhookDeliveryStatus } from '../../../../src/entities/webhook-delivery.entity';
import { WebhookProcessorService } from '../../../../src/modules/webhooks/services/webhook-processor.service';

vi.mock('../../../../src/common/utils/egress-url.util', () => ({
  assertPublicEgressUrl: vi.fn().mockResolvedValue(undefined),
  createPublicEgressHttpAgents: vi.fn(() => ({ httpAgent: {}, httpsAgent: {} })),
}));

const delivery = (id: string, subscriptionId: string) => ({
  id,
  subscriptionId,
  event: 'statement.processed',
  payload: { event: 'statement.processed', id },
  status: WebhookDeliveryStatus.PROCESSING,
  attemptCount: 0,
  maxAttempts: 3,
});

const subscription = (id: string, url: string, secret: string) => ({
  id,
  url,
  secret,
  isActive: true,
});

describe('WebhookProcessorService', () => {
  let service: WebhookProcessorService;
  let mockDeliveryRepo: { save: Mock; query: Mock; find: Mock };
  let mockSubRepo: { findOne: Mock };
  let post: Mock;

  beforeEach(() => {
    mockDeliveryRepo = { save: vi.fn(), query: vi.fn(), find: vi.fn() };
    mockSubRepo = { findOne: vi.fn() };
    service = new WebhookProcessorService(mockDeliveryRepo as any, mockSubRepo as any);
    post = vi.fn().mockResolvedValue({ status: 200, body: 'ok' });
    (service as any).postWithPinnedDns = post;
  });

  it('should compute correct HMAC-SHA256 signature', () => {
    const secret = 'my-secret';
    const payload = '{"event":"test"}';
    const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
    expect((service as any).buildSignature(secret, payload)).toBe(expected);
  });

  it('should compute correct exponential backoff', () => {
    // attempt 1 → 30s, attempt 2 → 300s (5min), attempt 3 → 3000s (50min)
    expect((service as any).backoffMs(1)).toBe(30_000);
    expect((service as any).backoffMs(2)).toBe(300_000);
    expect((service as any).backoffMs(3)).toBe(3_000_000);
  });

  it('sends a claimed delivery to its own subscription, signed with its secret', async () => {
    // Postgres hands back the claimed row in snake_case, as a raw UPDATE … RETURNING does.
    mockDeliveryRepo.query.mockResolvedValue([
      [{ id: 'd1', subscription_id: 'sub-a', attempt_count: 0, max_attempts: 3 }],
      1,
    ]);
    mockDeliveryRepo.find.mockResolvedValue([delivery('d1', 'sub-a')]);
    mockSubRepo.findOne.mockImplementation(({ where }: { where: { id?: string } }) =>
      Promise.resolve(
        where.id === 'sub-a'
          ? subscription('sub-a', 'https://a.example/hook', 'secret-a-0123456789')
          : subscription('sub-b', 'https://b.example/hook', 'secret-b-0123456789'),
      ),
    );

    await service.tick();

    expect(mockSubRepo.findOne).toHaveBeenCalledWith({ where: { id: 'sub-a' } });
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, headers] = post.mock.calls[0];
    expect(url).toBe('https://a.example/hook');
    expect(headers['X-Lumio-Signature']).toBe(
      'sha256=' + createHmac('sha256', 'secret-a-0123456789').update(body).digest('hex'),
    );
    expect(mockDeliveryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'd1',
        status: WebhookDeliveryStatus.SUCCESS,
        attemptCount: 1,
      }),
    );
  });

  it('claims a batch and sends at most five at a time', async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `d${i}`);
    mockDeliveryRepo.query.mockResolvedValue([ids.map(id => ({ id })), ids.length]);
    mockDeliveryRepo.find.mockResolvedValue(ids.map(id => delivery(id, 'sub-a')));
    mockSubRepo.findOne.mockResolvedValue(subscription('sub-a', 'https://a.example', 's'));

    let inFlight = 0;
    let peak = 0;
    post.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise(resolve => setImmediate(resolve));
      inFlight -= 1;
      return { status: 200, body: '' };
    });

    await service.tick();

    expect(mockDeliveryRepo.query.mock.calls[0][1]).toEqual([expect.any(String), 20]);
    expect(post).toHaveBeenCalledTimes(12);
    expect(peak).toBe(5);
  });

  it('keeps sending the rest of the batch when one delivery fails to process', async () => {
    mockDeliveryRepo.query.mockResolvedValue([[{ id: 'd1' }, { id: 'd2' }], 2]);
    mockDeliveryRepo.find.mockResolvedValue([delivery('d1', 'sub-a'), delivery('d2', 'sub-a')]);
    mockSubRepo.findOne.mockResolvedValue(subscription('sub-a', 'https://a.example', 's'));
    mockDeliveryRepo.save.mockRejectedValueOnce(new Error('db down')).mockResolvedValue({});

    await service.tick();

    expect(post).toHaveBeenCalledTimes(2);
    expect(mockDeliveryRepo.save).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no delivery is due', async () => {
    mockDeliveryRepo.query.mockResolvedValue([[], 0]);

    await service.tick();

    expect(mockDeliveryRepo.find).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
