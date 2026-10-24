import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, type Repository } from 'typeorm';
import { APP_NAME } from '../../../common/brand';
import { requireSecret } from '../../../common/utils/required-secret.util';
import {
  createVerificationToken,
  hashVerificationToken,
} from '../../../common/utils/verification-token.util';
import { AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import { EmailChangeToken } from '../../../entities/email-change-token.entity';
import { User } from '../../../entities/user.entity';
import { AuditService } from '../../audit/audit.service';
import { recordSecurityEvent } from '../../auth/security-audit.util';
import { MailerService } from '../../mailer/mailer.service';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class EmailChangeService {
  private readonly logger = new Logger(EmailChangeService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(EmailChangeToken)
    private readonly tokenRepository: Repository<EmailChangeToken>,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Records the requested address and mails a confirmation link to it. The
   * account is not touched until that link is opened: accepting an unverified
   * address let anyone point their account at a mailbox they cannot read, which
   * silently breaks every recovery path that depends on it — password reset
   * most of all.
   */
  async requestEmailChange(user: User, newEmail: string): Promise<void> {
    const normalized = newEmail.trim().toLowerCase();

    if (normalized === user.email.toLowerCase()) {
      throw new BadRequestException('That is already your email address');
    }

    const taken = await this.userRepository.findOne({
      where: { email: normalized, id: Not(user.id) },
      select: {
        id: true,
      },
    });
    if (taken) {
      throw new ConflictException('Email already in use');
    }

    // One pending change at a time.
    await this.tokenRepository.delete({ userId: user.id, usedAt: IsNull() });

    const token = createVerificationToken();
    await this.tokenRepository.save(
      this.tokenRepository.create({
        userId: user.id,
        newEmail: normalized,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        usedAt: null,
      }),
    );

    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user.workspaceId,
      actorId: user.id,
      entityType: EntityType.USER,
      entityId: user.id,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      meta: { emailChange: 'requested', oldEmail: user.email, newEmail: normalized },
    });

    const confirmUrl = `${this.frontendBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;

    // Sent to the NEW address — that is the whole point of the check.
    try {
      const sent = await this.mailerService.send({
        to: normalized,
        subject: `Confirm your new ${APP_NAME} email address`,
        text: [
          `Hello${user.name ? ` ${user.name}` : ''},`,
          '',
          `A request was made to change the ${APP_NAME} account email to ${normalized}.`,
          `Open this link to confirm it (valid for 24 hours): ${confirmUrl}`,
          '',
          'If this was not you, you can ignore this email — the account keeps its current address.',
        ].join('\n'),
        accountOf: user,
      });

      if (!sent) {
        this.logger.warn('Email change confirmation could not be sent — SMTP is not configured');
      }
    } catch (error) {
      this.logger.error(
        `Email change confirmation failed to send: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async confirmEmailChange(token: string): Promise<{ email: string }> {
    const record = await this.tokenRepository.findOne({
      where: { tokenHash: this.hashToken(token) },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Confirmation link is invalid or has expired');
    }

    // Re-check at confirmation time: the address may have been claimed by
    // someone else between the request and the click.
    const taken = await this.userRepository.findOne({
      where: { email: record.newEmail, id: Not(record.userId) },
      select: {
        id: true,
      },
    });
    if (taken) {
      throw new ConflictException('Email already in use');
    }

    const user = await this.userRepository.findOne({ where: { id: record.userId } });
    if (!user) {
      throw new BadRequestException('Confirmation link is invalid or has expired');
    }

    const oldEmail = user.email;
    user.email = record.newEmail;
    await this.userRepository.save(user);

    record.usedAt = new Date();
    await this.tokenRepository.save(record);

    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user.workspaceId,
      actorId: user.id,
      entityType: EntityType.USER,
      entityId: user.id,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      diff: { before: { email: oldEmail }, after: { email: user.email } },
      meta: { emailChange: 'confirmed', oldEmail, newEmail: user.email },
    });

    return { email: user.email };
  }

  private hashToken(token: string): string {
    const secret = requireSecret(
      'EMAIL_CHANGE_TOKEN_SECRET or JWT_SECRET',
      this.configService.get<string>('EMAIL_CHANGE_TOKEN_SECRET'),
      this.configService.get<string>('JWT_SECRET'),
    );
    return hashVerificationToken(token, secret);
  }

  private frontendBaseUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('APP_URL') ||
      'http://localhost:3000'
    );
  }
}
