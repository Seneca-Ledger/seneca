import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as qrCode from 'qrcode';
import type { Repository } from 'typeorm';
import { APP_NAME } from '../../common/brand';
import { appError } from '../../common/errors/app-error';
import { decryptText, encryptText } from '../../common/utils/encryption.util';
import { requireSecret } from '../../common/utils/required-secret.util';
import { User } from '../../entities';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import { recordSecurityEvent } from './security-audit.util';

const ISSUER = APP_NAME;
const RECOVERY_CODE_COUNT = 10;
/** Accept the neighbouring 30s steps so a slow phone clock still works. */
const EPOCH_TOLERANCE_SECONDS = 30;

export interface TwoFactorStatusDto {
  enabled: boolean;
  pendingSetup: boolean;
  recoveryCodesRemaining: number;
}

export interface TwoFactorSetupDto {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async getStatus(userId: string): Promise<TwoFactorStatusDto> {
    const user = await this.loadSecrets(userId);

    return {
      enabled: Boolean(user.twoFactorEnabledAt),
      pendingSetup: Boolean(user.twoFactorSecret) && !user.twoFactorEnabledAt,
      recoveryCodesRemaining: user.twoFactorRecoveryCodes?.length ?? 0,
    };
  }

  async setup(userId: string, password: string): Promise<TwoFactorSetupDto> {
    const user = await this.loadSecrets(userId);
    await this.assertPassword(user, password);

    if (user.twoFactorEnabledAt) {
      throw new BadRequestException(appError('AUTH_2FA_ALREADY_ENABLED'));
    }

    const secret = generateSecret();
    const otpauthUrl = generateURI({ issuer: ISSUER, label: user.email, secret });

    await this.userRepository.update(userId, { twoFactorSecret: encryptText(secret) });

    return { secret, otpauthUrl, qrDataUrl: await qrCode.toDataURL(otpauthUrl) };
  }

  /** Confirms the pending secret and hands back the one-time recovery codes. */
  async enable(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.loadSecrets(userId);

    if (user.twoFactorEnabledAt) {
      throw new BadRequestException(appError('AUTH_2FA_ALREADY_ENABLED'));
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException(appError('AUTH_2FA_SETUP_NOT_STARTED'));
    }
    if (!this.verifyTotp(user.twoFactorSecret, code)) {
      throw new UnauthorizedException(appError('AUTH_2FA_VERIFICATION_CODE_INVALID'));
    }

    const { codes, hashes } = this.generateRecoveryCodes();
    await this.userRepository.update(userId, {
      twoFactorEnabledAt: new Date(),
      twoFactorRecoveryCodes: hashes,
    });
    await this.recordTwoFactorEvent(user, Severity.WARN, 'enabled');

    return { recoveryCodes: codes };
  }

  async disable(userId: string, password: string): Promise<void> {
    const user = await this.loadSecrets(userId);
    await this.assertPassword(user, password);

    await this.userRepository.update(userId, {
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorRecoveryCodes: [],
    });
    await this.recordTwoFactorEvent(user, Severity.CRITICAL, 'disabled');
  }

  async regenerateRecoveryCodes(
    userId: string,
    password: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.loadSecrets(userId);
    await this.assertPassword(user, password);

    if (!user.twoFactorEnabledAt) {
      throw new BadRequestException(appError('AUTH_2FA_NOT_ENABLED'));
    }

    const { codes, hashes } = this.generateRecoveryCodes();
    await this.userRepository.update(userId, { twoFactorRecoveryCodes: hashes });
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user.workspaceId,
      actorId: user.id,
      entityType: EntityType.USER,
      entityId: user.id,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      meta: { recoveryCodes: 'regenerated' },
    });

    return { recoveryCodes: codes };
  }

  /**
   * Login-time check: a TOTP code, or a recovery code which is burned on use.
   * Throws instead of returning false so callers cannot forget to check.
   */
  async assertLoginCode(userId: string, code: string): Promise<void> {
    const user = await this.loadSecrets(userId);

    if (!(user.twoFactorEnabledAt && user.twoFactorSecret)) {
      return;
    }

    if (this.verifyTotp(user.twoFactorSecret, code)) {
      return;
    }

    const remaining = this.consumeRecoveryCode(user.twoFactorRecoveryCodes ?? [], code);
    if (!remaining) {
      throw new UnauthorizedException(appError('AUTH_2FA_CODE_INVALID'));
    }

    await this.userRepository.update(userId, { twoFactorRecoveryCodes: remaining });
  }

  /** Only the on/off state is logged — never the secret, URL or codes. */
  private async recordTwoFactorEvent(
    user: User,
    severity: Severity,
    twoFactor: 'enabled' | 'disabled',
  ): Promise<void> {
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user.workspaceId,
      actorId: user.id,
      entityType: EntityType.USER,
      entityId: user.id,
      action: AuditAction.UPDATE,
      severity,
      diff: {
        before: { twoFactor: twoFactor === 'enabled' ? 'disabled' : 'enabled' },
        after: { twoFactor },
      },
      meta: { twoFactor },
    });
  }

  private async loadSecrets(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        workspaceId: true,
        passwordHash: true,
        twoFactorSecret: true,
        twoFactorEnabledAt: true,
        twoFactorRecoveryCodes: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(appError('USER_NOT_FOUND'));
    }

    return user;
  }

  private async assertPassword(user: User, password: string): Promise<void> {
    const isValid = user.passwordHash
      ? await bcrypt.compare(password || '', user.passwordHash)
      : false;

    if (!isValid) {
      throw new ForbiddenException(appError('AUTH_CURRENT_PASSWORD_INCORRECT'));
    }
  }

  private verifyTotp(encryptedSecret: string, code: string): boolean {
    const token = (code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(token)) {
      return false;
    }

    return verifySync({
      secret: decryptText(encryptedSecret),
      token,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    }).valid;
  }

  /** Returns the remaining hashes when `code` matched, or null when it did not. */
  private consumeRecoveryCode(hashes: string[], code: string): string[] | null {
    const normalized = (code || '').trim().toUpperCase().replace(/\s/g, '');
    if (!normalized) {
      return null;
    }

    const candidate = this.hashRecoveryCode(normalized);
    const index = hashes.findIndex(hash => this.hashesMatch(hash, candidate));

    return index === -1 ? null : hashes.filter((_, position) => position !== index);
  }

  private generateRecoveryCodes(): { codes: string[]; hashes: string[] } {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => this.randomRecoveryCode());
    return { codes, hashes: codes.map(code => this.hashRecoveryCode(code)) };
  }

  private randomRecoveryCode(): string {
    // Crockford-ish alphabet: no O/I/L/U, so codes survive being read off paper.
    const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
    const chars = Array.from(randomBytes(10), byte => alphabet[byte % alphabet.length]);
    return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`;
  }

  private hashRecoveryCode(code: string): string {
    const secret = requireSecret(
      'SESSION_TOKEN_SALT or JWT_REFRESH_SECRET',
      this.configService.get<string>('SESSION_TOKEN_SALT'),
      this.configService.get<string>('JWT_REFRESH_SECRET'),
    );

    return createHmac('sha256', secret).update(code).digest('hex');
  }

  private hashesMatch(stored: string, candidate: string): boolean {
    const storedBuffer = Buffer.from(stored, 'hex');
    const candidateBuffer = Buffer.from(candidate, 'hex');

    return (
      storedBuffer.length === candidateBuffer.length &&
      timingSafeEqual(storedBuffer, candidateBuffer)
    );
  }
}
