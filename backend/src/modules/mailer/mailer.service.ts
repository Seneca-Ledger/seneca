import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { attemptWithRetry } from '../../common/effect/attempt-with-retry';
import type { User } from '../../entities/user.entity';
import {
  ApplicationSettingsService,
  smtpConnectTarget,
} from '../application-settings/application-settings.service';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

interface MailContent {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

/**
 * Whose SMTP server sends the mail; without workspace SMTP settings the SMTP_*
 * env vars do. Required, so no caller can fall back to someone's home workspace.
 */
export type SendMailParams = MailContent &
  (
    | {
        /** The workspace the mail is about. */
        workspaceId: string;
      }
    | {
        /** Mail about the account itself: password reset, e-mail change. */
        accountOf: Pick<User, 'id' | 'workspaceId'>;
      }
  );

/**
 * Thin wrapper over the workspace SMTP settings so callers do not each rebuild a
 * transporter. Returns false instead of throwing when SMTP is not configured —
 * a missing mail server must not fail the action that triggered the mail.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly applicationSettingsService: ApplicationSettingsService) {}

  async isConfigured(workspaceId: string): Promise<boolean> {
    const smtp = await this.applicationSettingsService.getSmtpSettings(workspaceId);
    return Boolean((smtp?.host || process.env.SMTP_HOST) && (smtp?.from || process.env.SMTP_FROM));
  }

  async send(params: SendMailParams): Promise<boolean> {
    const smtp = await this.smtpFor(params);
    const host = smtp?.host || process.env.SMTP_HOST;
    const from = smtp?.from || process.env.SMTP_FROM;

    if (!(host && from)) {
      this.logger.warn(`SMTP is not configured, skipping mail to ${params.to}`);
      return false;
    }

    const port = smtp?.port || Number.parseInt(process.env.SMTP_PORT || '587', 10);
    const user = smtp?.user || process.env.SMTP_USER;
    const pass = smtp?.pass || process.env.SMTP_PASS;
    const timeoutMs =
      smtp?.timeoutMs || Number.parseInt(process.env.SMTP_TIMEOUT_MS || '10000', 10);

    const transporter = nodemailer.createTransport({
      ...(await smtpConnectTarget(smtp, host)),
      port: Number.isFinite(port) ? port : 587,
      secure: smtp?.secure ?? process.env.SMTP_SECURE === 'true',
      auth: user && pass ? { user, pass } : undefined,
    });

    await attemptWithRetry(
      () =>
        transporter.sendMail({
          from,
          to: params.to,
          subject: params.subject,
          text: params.text,
          html: params.html,
          attachments: params.attachments,
          replyTo: smtp?.replyTo || process.env.SMTP_REPLY_TO || undefined,
        }),
      {
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 10000,
        timeoutMessage: 'SMTP request timed out',
        retries: 1,
        baseDelayMs: 300,
        maxDelayMs: 2000,
      },
    );

    return true;
  }

  private smtpFor(params: SendMailParams) {
    return 'accountOf' in params
      ? this.applicationSettingsService.getAccountSmtpSettings(params.accountOf)
      : this.applicationSettingsService.getSmtpSettings(params.workspaceId);
  }
}
