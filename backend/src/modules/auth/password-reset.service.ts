import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes } from 'crypto';
import { IsNull, LessThan, type Repository } from 'typeorm';
import { APP_NAME } from '../../common/brand';
import { hashPassword } from '../../common/utils/password-hash.util';
import { requireSecret } from '../../common/utils/required-secret.util';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { AuthSession } from '../../entities/auth-session.entity';
import { PasswordResetToken } from '../../entities/password-reset-token.entity';
import { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { MailerService } from '../mailer/mailer.service';
import { recordSecurityEvent } from './security-audit.util';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(AuthSession)
    private readonly authSessionRepository: Repository<AuthSession>,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Always resolves the same way whether or not the address belongs to an
   * account. Reporting "no such user" here would turn this endpoint into an
   * account-enumeration oracle, which is the usual way a reset flow leaks.
   */
  async requestReset(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      // workspaceId included so the mailer can use the SMTP the user set up in
      // their home workspace (see getAccountSmtpSettings).
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        workspaceId: true,
      },
    });

    if (!user || user.isActive === false) {
      this.logger.log('Password reset requested for an unknown or inactive address');
      return;
    }

    // Supersede any outstanding request: a user who clicks "forgot password"
    // twice should not leave an extra live token behind.
    await this.tokenRepository.delete({ userId: user.id, usedAt: IsNull() });

    const token = randomBytes(32).toString('hex');
    await this.tokenRepository.save(
      this.tokenRepository.create({
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        usedAt: null,
      }),
    );

    const resetUrl = `${this.frontendBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    // Delivery must never change the response. A mail failure that surfaced as
    // an error here would answer differently for a real address than for an
    // unknown one, which is precisely the enumeration leak this endpoint's
    // neutral message exists to prevent.
    try {
      const sent = await this.mailerService.send({
        to: user.email,
        subject: `Reset your ${APP_NAME} password`,
        text: [
          `Hello${user.name ? ` ${user.name}` : ''},`,
          '',
          `We received a request to reset your ${APP_NAME} password.`,
          `Open this link to choose a new one (valid for 1 hour): ${resetUrl}`,
          '',
          'If you did not ask for this, you can ignore this email — your password stays unchanged.',
        ].join('\n'),
        accountOf: user,
      });

      if (!sent) {
        // The mailer returns false rather than throwing when SMTP is unconfigured.
        this.logger.warn('Password reset email could not be sent — SMTP is not configured');
      }
    } catch (error) {
      this.logger.error(
        `Password reset email failed to send: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.tokenRepository.findOne({
      where: { tokenHash: this.hashToken(token) },
    });

    // One message for every failure mode: expired, already used, never existed.
    // Distinguishing them tells an attacker which guesses were closer.
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const user = await this.userRepository.findOne({ where: { id: record.userId } });
    if (!(user && user.isActive !== false)) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    user.passwordHash = await hashPassword(newPassword);
    // Bump the token version and revoke sessions: whoever forced the reset —
    // the owner recovering, or someone kicking out an intruder — expects every
    // existing login to stop working.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await this.userRepository.save(user);
    // IsNull(), not `revokedAt: null` — TypeORM renders a literal null
    // comparison for the latter, which never matches, so nothing was revoked.
    await this.authSessionRepository.update(
      { userId: user.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    record.usedAt = new Date();
    await this.tokenRepository.save(record);

    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user.workspaceId,
      actorId: user.id,
      entityType: EntityType.USER,
      entityId: user.id,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      meta: { password: 'reset', sessions: 'all-revoked' },
    });
  }

  /** Housekeeping so spent and stale grants do not accumulate forever. */
  async purgeExpiredTokens(): Promise<void> {
    await this.tokenRepository.delete({ expiresAt: LessThan(new Date()) });
  }

  /**
   * Stored as an HMAC, not the raw value: a leaked database row must not be
   * usable as a reset link.
   */
  private hashToken(token: string): string {
    const secret = requireSecret(
      'PASSWORD_RESET_TOKEN_SECRET or JWT_SECRET',
      this.configService.get<string>('PASSWORD_RESET_TOKEN_SECRET'),
      this.configService.get<string>('JWT_SECRET'),
    );
    return createHmac('sha256', secret).update(token).digest('hex');
  }

  private frontendBaseUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL') ||
      'http://localhost:3000'
    );
  }
}
