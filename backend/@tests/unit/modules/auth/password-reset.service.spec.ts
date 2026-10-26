import type { Mock } from 'vitest';
import { AuditAction, EntityType, Severity } from '@/entities/audit-event.entity';
import { PasswordResetService } from '@/modules/auth/password-reset.service';
import { BadRequestException } from '@nestjs/common';
import { IsNull } from 'typeorm';

const SECRET = 'test-reset-secret';

describe('PasswordResetService', () => {
  let userRepository: {
    findOne: Mock;
    save: Mock;
  };
  let tokenRepository: {
    findOne: Mock;
    save: Mock;
    create: Mock;
    delete: Mock;
  };
  let authSessionRepository: { update: Mock };
  let mailerService: { send: Mock };
  let auditService: { createEvent: Mock };
  let service: PasswordResetService;

  const activeUser = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    isActive: true,
    tokenVersion: 3,
    workspaceId: 'ws-1',
  };

  beforeEach(() => {
    userRepository = { findOne: vi.fn(), save: vi.fn(async u => u) };
    tokenRepository = {
      findOne: vi.fn(),
      save: vi.fn(async t => t),
      create: vi.fn(t => t),
      delete: vi.fn(),
    };
    authSessionRepository = { update: vi.fn() };
    mailerService = { send: vi.fn().mockResolvedValue(true) };
    auditService = { createEvent: vi.fn().mockResolvedValue({}) };

    service = new PasswordResetService(
      userRepository as never,
      tokenRepository as never,
      authSessionRepository as never,
      mailerService as never,
      { get: (key: string) => (key === 'JWT_SECRET' ? SECRET : undefined) } as never,
      auditService as never,
    );
  });

  describe('requestReset', () => {
    it('emails a link and stores only the hash of the token', async () => {
      userRepository.findOne.mockResolvedValue(activeUser);

      await service.requestReset('user@example.com');

      const stored = tokenRepository.save.mock.calls[0][0];
      const sentText = mailerService.send.mock.calls[0][0].text as string;
      const tokenInEmail = decodeURIComponent(
        /token=([^\s]+)/.exec(sentText)?.[1] ?? '',
      );

      expect(tokenInEmail).toHaveLength(64);
      // What lands in the database must not be usable as a reset link.
      expect(stored.tokenHash).not.toBe(tokenInEmail);
      expect(stored.tokenHash).toHaveLength(64);
      expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
      // Account mail: the mailer picks a server the user controls (getAccountSmtpSettings).
      expect(mailerService.send.mock.calls[0][0].accountOf).toBe(activeUser);
    });

    it('supersedes any outstanding request for the same user', async () => {
      userRepository.findOne.mockResolvedValue(activeUser);

      await service.requestReset('user@example.com');

      expect(tokenRepository.delete).toHaveBeenCalledWith({ userId: 'user-1', usedAt: IsNull() });
    });

    it('does nothing and still resolves for an unknown address', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.requestReset('nobody@example.com')).resolves.toBeUndefined();

      expect(tokenRepository.save).not.toHaveBeenCalled();
      expect(mailerService.send).not.toHaveBeenCalled();
    });

    it('does nothing for a deactivated account', async () => {
      userRepository.findOne.mockResolvedValue({ ...activeUser, isActive: false });

      await service.requestReset('user@example.com');

      expect(tokenRepository.save).not.toHaveBeenCalled();
    });

    // The neutral response is worthless if a mail failure surfaces as an error:
    // that alone would reveal which addresses exist.
    it('resolves even when sending the email throws', async () => {
      userRepository.findOne.mockResolvedValue(activeUser);
      mailerService.send.mockRejectedValue(new Error('smtp is down'));

      await expect(service.requestReset('user@example.com')).resolves.toBeUndefined();
    });

    it('resolves when SMTP is not configured at all', async () => {
      userRepository.findOne.mockResolvedValue(activeUser);
      mailerService.send.mockResolvedValue(false);

      await expect(service.requestReset('user@example.com')).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    const validRecord = () => ({
      id: 'token-1',
      userId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    it('sets the new password, burns the token and revokes every session', async () => {
      tokenRepository.findOne.mockResolvedValue(validRecord());
      userRepository.findOne.mockResolvedValue({ ...activeUser });

      await service.resetPassword('plain-token', 'BrandNewPass1');

      const saved = userRepository.save.mock.calls[0][0];
      expect(saved.passwordHash).toMatch(/^\$2[aby]\$/);
      // Every issued token stops verifying.
      expect(saved.tokenVersion).toBe(4);
      // IsNull(), not a literal null — a literal never matches in TypeORM.
      expect(authSessionRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', revokedAt: IsNull() },
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
      expect(tokenRepository.save.mock.calls[0][0].usedAt).toBeInstanceOf(Date);
    });

    it('logs the completed reset without the password, hash or token', async () => {
      tokenRepository.findOne.mockResolvedValue(validRecord());
      userRepository.findOne.mockResolvedValue({ ...activeUser });

      await service.resetPassword('plain-token', 'BrandNewPass1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          actorId: 'user-1',
          entityType: EntityType.USER,
          entityId: 'user-1',
          action: AuditAction.UPDATE,
          severity: Severity.WARN,
          meta: { password: 'reset', sessions: 'all-revoked' },
        }),
      );
      const payload = JSON.stringify(auditService.createEvent.mock.calls);
      const { passwordHash } = userRepository.save.mock.calls[0][0];
      for (const leaked of ['plain-token', 'BrandNewPass1', passwordHash]) {
        expect(payload).not.toContain(leaked);
      }
    });

    it('completes the reset when the audit write fails', async () => {
      tokenRepository.findOne.mockResolvedValue(validRecord());
      userRepository.findOne.mockResolvedValue({ ...activeUser });
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(service.resetPassword('plain-token', 'BrandNewPass1')).resolves.toBeUndefined();
      expect(tokenRepository.save.mock.calls[0][0].usedAt).toBeInstanceOf(Date);
    });

    it('rejects a token that was already used', async () => {
      tokenRepository.findOne.mockResolvedValue({ ...validRecord(), usedAt: new Date() });

      await expect(service.resetPassword('plain-token', 'BrandNewPass1')).rejects.toThrow(
        BadRequestException,
      );
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      tokenRepository.findOne.mockResolvedValue({
        ...validRecord(),
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword('plain-token', 'BrandNewPass1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an unknown token', async () => {
      tokenRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword('nope', 'BrandNewPass1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('gives the same message for every failure mode', async () => {
      const messages: string[] = [];
      for (const record of [
        null,
        { ...validRecord(), usedAt: new Date() },
        { ...validRecord(), expiresAt: new Date(Date.now() - 1000) },
      ]) {
        tokenRepository.findOne.mockResolvedValue(record);
        await service.resetPassword('t', 'BrandNewPass1').catch((error: Error) => {
          messages.push(error.message);
        });
      }

      expect(new Set(messages).size).toBe(1);
    });

    it('looks the token up by its hash, never by the plaintext', async () => {
      tokenRepository.findOne.mockResolvedValue(null);

      await service.resetPassword('plain-token', 'BrandNewPass1').catch(() => undefined);

      const where = tokenRepository.findOne.mock.calls[0][0].where;
      expect(where.tokenHash).not.toBe('plain-token');
      expect(where.tokenHash).toHaveLength(64);
    });
  });
});
