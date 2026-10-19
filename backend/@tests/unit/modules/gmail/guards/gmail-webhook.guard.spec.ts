import { GmailWebhookGuard } from '@/modules/gmail/guards/gmail-webhook.guard';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

describe('GmailWebhookGuard', () => {
  let guard: GmailWebhookGuard;
  const ORIGINAL_ENV = process.env;

  function makeContext(headers: Record<string, string> = {}): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    guard = new GmailWebhookGuard();
    // Reset env to a clean copy for each test
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('when PUBSUB_WEBHOOK_TOKEN is configured', () => {
    beforeEach(() => {
      process.env.PUBSUB_WEBHOOK_TOKEN = 'secret-token-123';
    });

    it('allows request with valid Bearer token', () => {
      const context = makeContext({ authorization: 'Bearer secret-token-123' });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('throws UnauthorizedException for invalid token', () => {
      const context = makeContext({ authorization: 'Bearer wrong-token' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when Authorization header is missing', () => {
      const context = makeContext({});

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid webhook authentication');
    });

    it('throws UnauthorizedException when Authorization header is not Bearer scheme', () => {
      const context = makeContext({ authorization: 'Basic secret-token-123' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for empty Bearer token', () => {
      const context = makeContext({ authorization: 'Bearer ' });

      // Empty string after 'Bearer ' does not match the expected token
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('is case-sensitive: rejects token with wrong casing', () => {
      const context = makeContext({ authorization: 'Bearer SECRET-TOKEN-123' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('when PUBSUB_WEBHOOK_TOKEN is NOT configured', () => {
    beforeEach(() => {
      delete process.env.PUBSUB_WEBHOOK_TOKEN;
    });

    // Deny by default. The guard used to pass any request whenever NODE_ENV was
    // not exactly 'production', which left this public endpoint open on staging.
    it('rejects a request even with a Bearer token when the env var is unset', () => {
      const context = makeContext({ authorization: 'Bearer any-token' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('rejects outside production too', () => {
      process.env.NODE_ENV = 'development';
      const context = makeContext({ authorization: 'Bearer any-token' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when Authorization header is completely missing', () => {
      const context = makeContext({});

      // Guard checks for Bearer header BEFORE checking if token is configured
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  describe('when PUBSUB_WEBHOOK_TOKEN is empty string', () => {
    beforeEach(() => {
      process.env.PUBSUB_WEBHOOK_TOKEN = '';
    });

    it('treats an empty value as unconfigured and rejects', () => {
      const context = makeContext({ authorization: 'Bearer any-token' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });
});
