import type { Mock, Mocked } from 'vitest';
import { User } from '@/entities';
import { AuditAction, EntityType, Severity } from '@/entities/audit-event.entity';
import { AuditService } from '@/modules/audit/audit.service';
import { TwoFactorService } from '@/modules/auth/two-factor.service';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { generateSync } from 'otplib';
import type { Repository } from 'typeorm';
import { APP_NAME } from '../../../../src/common/brand';

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let userRepository: Mocked<Repository<User>>;
  let stored: Partial<User>;
  let auditService: { createEvent: Mock };

  beforeEach(async () => {
    stored = {
      id: 'u1',
      email: 'user@example.com',
      workspaceId: 'ws-home',
      passwordHash: await bcrypt.hash('correct-password', 4),
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorRecoveryCodes: [],
    };

    auditService = { createEvent: vi.fn().mockResolvedValue({}) };

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: vi.fn(async () => stored as User),
            update: vi.fn(async (_id: string, patch: Partial<User>) => {
              Object.assign(stored, patch);
              return { affected: 1 };
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'session-salt') },
        },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = testingModule.get(TwoFactorService);
    userRepository = testingModule.get(getRepositoryToken(User));
  });

  const enable = async () => {
    const { secret } = await service.setup('u1', 'correct-password');
    const { recoveryCodes } = await service.enable('u1', generateSync({ secret }));
    return { secret, recoveryCodes };
  };

  it('rejects setup when the current password is wrong', async () => {
    await expect(service.setup('u1', 'nope')).rejects.toBeInstanceOf(ForbiddenException);
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('stores the secret encrypted and stays disabled until a code is confirmed', async () => {
    const { secret, otpauthUrl } = await service.setup('u1', 'correct-password');

    expect(otpauthUrl).toContain(`otpauth://totp/${APP_NAME}`);
    expect(stored.twoFactorSecret).toMatch(/^enc:/);
    expect(stored.twoFactorSecret).not.toContain(secret);
    await expect(service.getStatus('u1')).resolves.toMatchObject({
      enabled: false,
      pendingSetup: true,
    });
  });

  it('enables only with a valid code and issues recovery codes once', async () => {
    const { secret } = await service.setup('u1', 'correct-password');

    await expect(service.enable('u1', '000000')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(stored.twoFactorEnabledAt).toBeNull();

    const { recoveryCodes } = await service.enable('u1', generateSync({ secret }));

    expect(recoveryCodes).toHaveLength(10);
    expect(stored.twoFactorEnabledAt).toBeInstanceOf(Date);
    // Only hashes are persisted — the plaintext codes never hit the database.
    expect(stored.twoFactorRecoveryCodes).toHaveLength(10);
    expect(stored.twoFactorRecoveryCodes).not.toEqual(expect.arrayContaining(recoveryCodes));
  });

  it('accepts a current TOTP code at login and rejects a wrong one', async () => {
    const { secret } = await enable();

    await expect(service.assertLoginCode('u1', generateSync({ secret }))).resolves.toBeUndefined();
    await expect(service.assertLoginCode('u1', '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('burns a recovery code after a single use', async () => {
    const { recoveryCodes } = await enable();
    const code = recoveryCodes[0];

    await expect(service.assertLoginCode('u1', code.toLowerCase())).resolves.toBeUndefined();
    expect(stored.twoFactorRecoveryCodes).toHaveLength(9);

    await expect(service.assertLoginCode('u1', code)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(stored.twoFactorRecoveryCodes).toHaveLength(9);
  });

  it('clears every 2FA field on disable and refuses a wrong password', async () => {
    await enable();

    await expect(service.disable('u1', 'nope')).rejects.toBeInstanceOf(ForbiddenException);
    expect(stored.twoFactorEnabledAt).toBeInstanceOf(Date);

    await service.disable('u1', 'correct-password');

    expect(stored).toMatchObject({
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorRecoveryCodes: [],
    });
  });

  it('replaces recovery codes on regeneration and only while enabled', async () => {
    await expect(
      service.regenerateRecoveryCodes('u1', 'correct-password'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const { recoveryCodes } = await enable();
    const { recoveryCodes: next } = await service.regenerateRecoveryCodes('u1', 'correct-password');

    expect(next).toHaveLength(10);
    expect(next).not.toEqual(expect.arrayContaining(recoveryCodes));
    await expect(service.assertLoginCode('u1', recoveryCodes[0])).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  describe('audit events', () => {
    const auditPayloads = () => JSON.stringify(auditService.createEvent.mock.calls);

    it('logs enable as WARN and never the secret, otpauth URL or recovery codes', async () => {
      const { secret, otpauthUrl } = await service.setup('u1', 'correct-password');
      expect(auditService.createEvent).not.toHaveBeenCalled();

      const { recoveryCodes } = await service.enable('u1', generateSync({ secret }));

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-home',
          actorId: 'u1',
          entityType: EntityType.USER,
          entityId: 'u1',
          action: AuditAction.UPDATE,
          severity: Severity.WARN,
          meta: { twoFactor: 'enabled' },
        }),
      );
      const payload = auditPayloads();
      for (const leaked of [secret, otpauthUrl, ...recoveryCodes, 'correct-password']) {
        expect(payload).not.toContain(leaked);
      }
      expect(payload).not.toMatch(/passwordHash|twoFactorSecret|twoFactorRecoveryCodes/);
    });

    it('logs disable as CRITICAL', async () => {
      await enable();
      auditService.createEvent.mockClear();

      await service.disable('u1', 'correct-password');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          severity: Severity.CRITICAL,
          meta: { twoFactor: 'disabled' },
        }),
      );
    });

    it('logs recovery-code regeneration without the codes', async () => {
      await enable();
      auditService.createEvent.mockClear();

      const { recoveryCodes } = await service.regenerateRecoveryCodes('u1', 'correct-password');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: Severity.WARN,
          meta: { recoveryCodes: 'regenerated' },
        }),
      );
      for (const code of recoveryCodes) {
        expect(auditPayloads()).not.toContain(code);
      }
    });

    it('does not log a refused change', async () => {
      await enable();
      auditService.createEvent.mockClear();

      await expect(service.disable('u1', 'nope')).rejects.toBeInstanceOf(ForbiddenException);
      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('still disables 2FA when the audit write fails', async () => {
      await enable();
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(service.disable('u1', 'correct-password')).resolves.toBeUndefined();
      expect(stored.twoFactorEnabledAt).toBeNull();
    });

    it('skips the event when the user has no home workspace', async () => {
      stored.workspaceId = null;
      await enable();

      expect(auditService.createEvent).not.toHaveBeenCalled();
    });
  });
});
