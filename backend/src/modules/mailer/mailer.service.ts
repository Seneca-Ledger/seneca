import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { retry, TimeoutError, withTimeout } from '../../common/utils/async.util';
import type { User } from '../../entities/user.entity';
import { ApplicationSettingsService } from '../application-settings/application-settings.service';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Whose workspace SMTP settings to use; falls back to the SMTP_* env vars. */
  user?: User | null;
  /**
   * Which workspace's SMTP settings to use. Without it the user's *home*
   * workspace decides, which is the wrong server for mail about another one.
   */
  workspaceId?: string;
  attachments?: MailAttachment[];
}

/**
 * Thin wrapper over the workspace SMTP settings so callers do not each rebuild a
 * transporter. Returns false instead of throwing when SMTP is not configured —
 * a missing mail server must not fail the action that triggered the mail.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly applicationSettingsService: ApplicationSettingsService) {}

  async isConfigured(user?: User | null, workspaceId?: string): Promise<boolean> {
    const smtp = await this.applicationSettingsService.getSmtpSettings(user, workspaceId);
    return Boolean((smtp?.host || process.env.SMTP_HOST) && (smtp?.from || process.env.SMTP_FROM));
  }

  async send(params: SendMailParams): Promise<boolean> {
    const smtp = await this.applicationSettingsService.getSmtpSettings(
      params.user,
      params.workspaceId,
    );
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
      host,
      port: Number.isFinite(port) ? port : 587,
      secure: smtp?.secure ?? process.env.SMTP_SECURE === 'true',
      auth: user && pass ? { user, pass } : undefined,
    });

    await retry(
      () =>
        withTimeout(
          transporter.sendMail({
            from,
            to: params.to,
            subject: params.subject,
            text: params.text,
            html: params.html,
            attachments: params.attachments,
            replyTo: smtp?.replyTo || process.env.SMTP_REPLY_TO || undefined,
          }),
          Number.isFinite(timeoutMs) ? timeoutMs : 10000,
          'SMTP request timed out',
        ),
      {
        retries: 1,
        baseDelayMs: 300,
        maxDelayMs: 2000,
        isRetryable: error => error instanceof TimeoutError,
      },
    );

    return true;
  }
}
