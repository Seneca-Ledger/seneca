import { createHmac } from 'node:crypto';
import { WebhookProcessorService } from '../../../../src/modules/webhooks/services/webhook-processor.service';
import { WebhookDeliveryStatus } from '../../../../src/entities/webhook-delivery.entity';

describe('WebhookProcessorService', () => {
  let service: WebhookProcessorService;
  const mockDeliveryRepo = {
    createQueryBuilder: vi.fn(),
    save: vi.fn(),
    query: vi.fn(),
  };
  const mockSubRepo = { findOne: vi.fn() };

  beforeEach(() => {
    service = new WebhookProcessorService(mockDeliveryRepo as any, mockSubRepo as any);
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
});
