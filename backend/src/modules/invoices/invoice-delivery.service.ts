import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { Client } from '../../entities/client.entity';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import {
  InvoiceDelivery,
  InvoiceDeliveryChannel,
  InvoiceDeliveryStatus,
} from '../../entities/invoice-delivery.entity';
import type { User } from '../../entities/user.entity';
import type { WorkspaceBusinessProfile } from '../../entities/workspace-business-profile.entity';
import { BusinessProfileService } from '../business-profile/business-profile.service';
import { MailerService } from '../mailer/mailer.service';
import { type InvoiceLabelMap, renderInvoiceLabels } from './invoice-document.translations';
import { InvoicesService } from './invoices.service';

/**
 * The page a client opens. `APP_URL` is the public address of the install;
 * without one there is no link to send and the email carries only the PDF.
 */
export function publicInvoiceUrl(shareToken: string | null): string | null {
  const base = (process.env.APP_URL || process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
  return base && shareToken ? `${base}/shared/invoices/${shareToken}` : null;
}

export interface SendInvoiceEmailInput {
  /** Overrides the client's stored address for this one send. */
  to?: string;
  subject?: string;
  message?: string;
}

export interface ComposeOptions {
  /** The hosted page, when the invoice has a share link. */
  link?: string | null;
  /**
   * Days from the due date, when this is a scheduled reminder: the opening
   * line says "is due on" before it and "was due on" after.
   */
  reminderOffset?: number | null;
}

/** The email, composed from the same labels the document prints. */
export function composeInvoiceEmail(
  invoice: Invoice,
  profile: WorkspaceBusinessProfile,
  labels: InvoiceLabelMap,
  options: ComposeOptions = {},
): { subject: string; text: string } {
  const { link, reminderOffset } = options;
  const isReminder = typeof reminderOffset === 'number';
  const issuer = profile.legalName?.trim() || '';
  const number = invoice.invoiceNumber ?? '';
  const fill = (template: string): string =>
    template
      .replace('{number}', number)
      .replace('{issuer}', issuer)
      .replace('{due}', invoice.dueDate);

  const total = `${Number(invoice.total).toFixed(2)} ${invoice.currency}`;
  const opening = isReminder
    ? reminderOffset > 0
      ? labels.reminderAfter
      : labels.reminderBefore
    : labels.emailIntro;
  const lines = [
    fill(opening),
    '',
    `${labels.total}: ${total}`,
    `${labels.dueDate}: ${invoice.dueDate}`,
  ];
  if (link) {
    // A link beats an attachment for the sender: a client who opens it leaves
    // a trace, and one who never does is visible before the due date passes.
    lines.push('', labels.emailLink.replace('{url}', link));
  }

  const payment = [
    profile.bankName ? `${labels.bank}: ${profile.bankName}` : null,
    profile.bankAccount ? `${labels.bankAccount}: ${profile.bankAccount}` : null,
    profile.bankCode ? `${labels.bankCode}: ${profile.bankCode}` : null,
    profile.paymentInstructions?.trim() || null,
  ].filter((line): line is string => Boolean(line));
  if (payment.length > 0) {
    lines.push('', `${labels.paymentDetails}:`, ...payment);
  }
  if (profile.invoiceFooter?.trim()) {
    lines.push('', profile.invoiceFooter.trim());
  }

  return {
    subject: fill(isReminder ? labels.reminderSubject : labels.emailSubject),
    text: lines.join('\n'),
  };
}

/**
 * Putting a sent invoice in front of its client.
 *
 * Separate from issuing it: `send` assigns the number and books the accrual,
 * this hands the document over — and may be repeated, because "can you resend
 * it" is the most ordinary request a client makes. Every attempt is logged,
 * including the ones SMTP refused, so the card never shows a hopeful "sent"
 * over a mail that never left.
 */
@Injectable()
export class InvoiceDeliveryService {
  private readonly logger = new Logger(InvoiceDeliveryService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceDelivery)
    private readonly deliveryRepository: Repository<InvoiceDelivery>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly invoicesService: InvoicesService,
    private readonly businessProfile: BusinessProfileService,
    private readonly mailerService: MailerService,
  ) {}

  async history(invoiceId: string, workspaceId: string): Promise<InvoiceDelivery[]> {
    await this.invoicesService.findOne(invoiceId, workspaceId);
    return this.deliveryRepository.find({
      where: { invoiceId, workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async sendEmail(
    invoiceId: string,
    workspaceId: string,
    user: User,
    input: SendInvoiceEmailInput = {},
    /** Set by the scheduler; makes the row unique per invoice and offset. */
    reminderOffset: number | null = null,
  ): Promise<InvoiceDelivery> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, workspaceId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    // A draft has no number and no stored document; issuing it is a separate,
    // irreversible step the user takes deliberately.
    if (invoice.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException(appError('INVOICE_NOT_SENT_YET'));
    }

    const client = await this.clientRepository.findOne({
      where: { id: invoice.clientId, workspaceId },
    });
    const recipient = (input.to?.trim() || client?.email || '').trim();
    if (!recipient) {
      throw new BadRequestException(appError('INVOICE_NO_RECIPIENT'));
    }

    const profile = await this.businessProfile.get(workspaceId);
    const labels = renderInvoiceLabels(client?.locale);
    const composed = client
      ? composeInvoiceEmail(invoice, profile, labels, {
          link: publicInvoiceUrl(invoice.shareToken),
          reminderOffset,
        })
      : { subject: labels.invoice, text: '' };
    const subject = input.subject?.trim() || composed.subject;
    const text = input.message?.trim() || composed.text;

    const pdf = await this.invoicesService.getPdf(invoiceId, workspaceId);

    const log = (status: InvoiceDeliveryStatus, error?: string) =>
      this.deliveryRepository.save(
        this.deliveryRepository.create({
          invoiceId,
          workspaceId,
          sentById: user.id,
          channel: InvoiceDeliveryChannel.EMAIL,
          recipient,
          status,
          subject,
          error: error ?? null,
          reminderOffset,
        }),
      );

    try {
      const delivered = await this.mailerService.send({
        to: recipient,
        subject,
        text,
        user,
        workspaceId,
        attachments: [
          { filename: pdf.fileName, content: pdf.data, contentType: 'application/pdf' },
        ],
      });
      // `send` returns false rather than throwing when no SMTP is configured:
      // that is a setup gap, not a failure to be retried.
      return log(delivered ? InvoiceDeliveryStatus.SENT : InvoiceDeliveryStatus.SKIPPED);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Invoice ${invoiceId} could not be emailed to ${recipient}: ${message}`);
      return log(InvoiceDeliveryStatus.FAILED, message);
    }
  }
}
