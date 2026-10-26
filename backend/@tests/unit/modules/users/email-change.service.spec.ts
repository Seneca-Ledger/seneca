import type { Mock } from 'vitest';
import { AuditAction, EntityType, Severity } from '@/entities/audit-event.entity';
import { EmailChangeService } from '@/modules/users/services/email-change.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { IsNull } from 'typeorm';

describe('EmailChangeService', () => {
  let userRepository: { findOne: Mock; save: Mock };
  let tokenRepository: {
    findOne: Mock;
    save: Mock;
    create: Mock;
    delete: Mock;
  };
  let mailerService: { send: Mock };
  let auditService: { createEvent: Mock };
  let service: EmailChangeService;

  const currentUser = {
    id: 'user-1',
    email: 'old@example.com',
    name: 'User',
    workspaceId: 'ws-1',
  } as never;

  beforeEach(() => {
    userRepository = { findOne: vi.fn().mockResolvedValue(null), save: vi.fn(async u => u) };
    tokenRepository = {
      findOne: vi.fn(),
      save: vi.fn(async t => t),
      create: vi.fn(t => t),
      delete: vi.fn(),
    };
    mailerService = { send: vi.fn().mockResolvedValue(true) };
    auditService = { createEvent: vi.fn().mockResolvedValue({}) };

    service = new EmailChangeService(
      userRepository as never,
      tokenRepository as never,
      mailerService as never,
      { get: (key: string) => (key === 'JWT_SECRET' ? 'secret' : undefined) } as never,
      auditService as never,
    );
  });

  describe('requestEmailChange', () => {
    it('does not touch the account — it only stores a pending token', async () => {
      await service.requestEmailChange(currentUser, 'new@example.com');

      expect(userRepository.save).not.toHaveBeenCalled();
      expect(tokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', newEmail: 'new@example.com' }),
      );
    });

    it('sends the confirmation to the new address, not the current one', async () => {
      await service.requestEmailChange(currentUser, 'new@example.com');

      expect(mailerService.send.mock.calls[0][0].to).toBe('new@example.com');
    });

    it('stores only the hash of the token', async () => {
      await service.requestEmailChange(currentUser, 'new@example.com');

      const stored = tokenRepository.save.mock.calls[0][0];
      const tokenInEmail = decodeURIComponent(
        /token=([^\s]+)/.exec(mailerService.send.mock.calls[0][0].text)?.[1] ?? '',
      );

      expect(tokenInEmail).toHaveLength(64);
      expect(stored.tokenHash).not.toBe(tokenInEmail);
    });

    it('normalizes the address and supersedes any pending request', async () => {
      await service.requestEmailChange(currentUser, '  NEW@Example.COM ');

      expect(tokenRepository.delete).toHaveBeenCalledWith({ userId: 'user-1', usedAt: IsNull() });
      expect(tokenRepository.save.mock.calls[0][0].newEmail).toBe('new@example.com');
    });

    it('rejects an address already used by someone else', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'someone-else' });

      await expect(service.requestEmailChange(currentUser, 'taken@example.com')).rejects.toThrow(
        ConflictException,
      );
      expect(tokenRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a no-op change', async () => {
      await expect(service.requestEmailChange(currentUser, 'OLD@example.com')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('still resolves when the confirmation email cannot be sent', async () => {
      mailerService.send.mockRejectedValue(new Error('smtp down'));

      await expect(
        service.requestEmailChange(currentUser, 'new@example.com'),
      ).resolves.toBeUndefined();
    });
  });

  describe('confirmEmailChange', () => {
    const validRecord = () => ({
      id: 'token-1',
      userId: 'user-1',
      newEmail: 'new@example.com',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    it('applies the address and burns the token', async () => {
      tokenRepository.findOne.mockResolvedValue(validRecord());
      userRepository.findOne
        .mockResolvedValueOnce(null) // nobody else claimed it
        .mockResolvedValueOnce({ id: 'user-1', email: 'old@example.com' });

      const result = await service.confirmEmailChange('plain');

      expect(result.email).toBe('new@example.com');
      expect(userRepository.save.mock.calls[0][0].email).toBe('new@example.com');
      expect(tokenRepository.save.mock.calls[0][0].usedAt).toBeInstanceOf(Date);
    });

    it('rejects a used token', async () => {
      tokenRepository.findOne.mockResolvedValue({ ...validRecord(), usedAt: new Date() });

      await expect(service.confirmEmailChange('plain')).rejects.toThrow(BadRequestException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      tokenRepository.findOne.mockResolvedValue({
        ...validRecord(),
        expiresAt: new Date(Date.now() - 1),
      });

      await expect(service.confirmEmailChange('plain')).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown token', async () => {
      tokenRepository.findOne.mockResolvedValue(null);

      await expect(service.confirmEmailChange('plain')).rejects.toThrow(BadRequestException);
    });

    // The address can be claimed between the request and the click.
    it('re-checks availability at confirmation time', async () => {
      tokenRepository.findOne.mockResolvedValue(validRecord());
      userRepository.findOne.mockResolvedValue({ id: 'someone-else' });

      await expect(service.confirmEmailChange('plain')).rejects.toThrow(ConflictException);
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('audit events', () => {
    it('logs the request with old and new address but not the token', async () => {
      await service.requestEmailChange(currentUser, 'New@Example.com');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          actorId: 'user-1',
          entityType: EntityType.USER,
          entityId: 'user-1',
          action: AuditAction.UPDATE,
          severity: Severity.WARN,
          meta: {
            emailChange: 'requested',
            oldEmail: 'old@example.com',
            newEmail: 'new@example.com',
          },
        }),
      );
      const token = /token=([^\s]+)/.exec(mailerService.send.mock.calls[0][0].text)?.[1] ?? '';
      const { tokenHash } = tokenRepository.save.mock.calls[0][0];
      const payload = JSON.stringify(auditService.createEvent.mock.calls);
      expect(token).not.toBe('');
      expect(payload).not.toContain(decodeURIComponent(token));
      expect(payload).not.toContain(tokenHash);
    });

    it('logs the confirmed change as a before/after email diff', async () => {
      tokenRepository.findOne.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        newEmail: 'new@example.com',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'user-1', email: 'old@example.com', workspaceId: 'ws-1' });

      await service.confirmEmailChange('plain');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          severity: Severity.WARN,
          diff: { before: { email: 'old@example.com' }, after: { email: 'new@example.com' } },
          meta: expect.objectContaining({ emailChange: 'confirmed' }),
        }),
      );
      expect(JSON.stringify(auditService.createEvent.mock.calls)).not.toContain('plain');
    });

    it('still stores the pending change when the audit write fails', async () => {
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(
        service.requestEmailChange(currentUser, 'new@example.com'),
      ).resolves.toBeUndefined();
      expect(mailerService.send).toHaveBeenCalled();
    });
  });
});
