import { describe, expect, it } from 'vitest';
import { inboundWebhookUrls } from './webhook-urls';

describe('inboundWebhookUrls', () => {
  it('builds absolute upload URLs from a relative API base behind a proxy', () => {
    expect(inboundWebhookUrls('/api/v1', 'https://lumio.example.com', 'tok123')).toEqual({
      statements: 'https://lumio.example.com/api/v1/webhooks/tok123/statements',
      receipts: 'https://lumio.example.com/api/v1/webhooks/tok123/receipts',
    });
  });

  it('keeps an absolute API base', () => {
    expect(inboundWebhookUrls('http://localhost:3001/api/v1/', 'http://localhost:3000', 't').receipts).toBe(
      'http://localhost:3001/api/v1/webhooks/t/receipts',
    );
  });
});
