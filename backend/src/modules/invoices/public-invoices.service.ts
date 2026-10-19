import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../../entities/client.entity';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { Payable, PayableStatus } from '../../entities/payable.entity';
import { BusinessProfileService } from '../business-profile/business-profile.service';
import { type InvoiceLabelMap, renderInvoiceLabels } from './invoice-document.translations';

/** The invoice as the client sees it: no ids, no workspace, nothing internal. */
export interface PublicInvoiceView {
  number: string;
  status: 'sent' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  pricesIncludeTax: boolean;
  notes: string | null;
  locale: string | null;
  /**
   * Rendered server-side in the client's language: the page has no dictionary
   * of its own, so the link and the PDF can never disagree about a word.
   */
  labels: InvoiceLabelMap;
  issuer: {
    legalName: string | null;
    addressLines: string | null;
    registrationId: string | null;
    taxId: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    bankName: string | null;
    bankAccount: string | null;
    bankCode: string | null;
    paymentInstructions: string | null;
    invoiceFooter: string | null;
    logoUrl: string | null;
  };
  billedTo: {
    name: string;
    addressLines: string | null;
    taxId: string | null;
  };
  lines: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
}

/**
 * The invoice behind a share link.
 *
 * No authentication: the token in the url is the whole credential, so this
 * returns a view built by hand rather than an entity — a client must not
 * receive workspace ids, internal statuses or the ledger's side of the story.
 */
@Injectable()
export class PublicInvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Payable)
    private readonly payableRepository: Repository<Payable>,
    private readonly businessProfile: BusinessProfileService,
  ) {}

  /** Marks the first open, then returns what the page renders. */
  async view(token: string): Promise<PublicInvoiceView> {
    const invoice = await this.require(token);
    await this.recordView(invoice);

    const [client, profile, status] = await Promise.all([
      this.clientRepository.findOne({ where: { id: invoice.clientId } }),
      this.businessProfile.get(invoice.workspaceId),
      this.publicStatus(invoice),
    ]);

    return {
      number: invoice.invoiceNumber ?? '',
      status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      subtotal: String(invoice.subtotal),
      taxTotal: String(invoice.taxTotal),
      total: String(invoice.total),
      pricesIncludeTax: invoice.pricesIncludeTax,
      notes: invoice.notes,
      locale: client?.locale ?? null,
      labels: renderInvoiceLabels(client?.locale),
      issuer: {
        legalName: profile.legalName,
        addressLines: profile.addressLines,
        registrationId: profile.registrationId,
        taxId: profile.taxId,
        email: profile.email,
        phone: profile.phone,
        website: profile.website,
        bankName: profile.bankName,
        bankAccount: profile.bankAccount,
        bankCode: profile.bankCode,
        paymentInstructions: profile.paymentInstructions,
        invoiceFooter: profile.invoiceFooter,
        logoUrl: profile.logoFile
          ? `/api/v1/business-profile/logo/${encodeURIComponent(profile.logoFile)}`
          : null,
      },
      billedTo: {
        name: client?.name ?? '',
        addressLines: client?.billingAddress ?? null,
        taxId: client?.taxId ?? null,
      },
      lines: (invoice.lineItems ?? []).map(item => ({
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        amount: String(Math.round(Number(item.quantity) * Number(item.unitPrice) * 100) / 100),
      })),
    };
  }

  /** The stored document, for the download button on the page. */
  async pdf(token: string): Promise<{ fileName: string; data: Buffer }> {
    const invoice = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .addSelect('invoice.fileData')
      .where('invoice.shareToken = :token', { token })
      .andWhere('invoice.deletedAt IS NULL')
      .getOne();
    if (!invoice?.fileData || invoice.status === InvoiceStatus.VOID) {
      throw new NotFoundException('Invoice not found');
    }
    await this.recordView(invoice);
    return { fileName: `${invoice.invoiceNumber ?? 'invoice'}.pdf`, data: invoice.fileData };
  }

  private async require(token: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { shareToken: token },
      relations: { lineItems: true },
      order: { lineItems: { sortOrder: 'ASC' } },
    });
    // A void'd invoice is withdrawn: the link stops working rather than
    // showing a document the client should no longer act on.
    if (!invoice || invoice.deletedAt || invoice.status === InvoiceStatus.VOID) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  /** Paid and overdue live on the receivable, as everywhere else. */
  private async publicStatus(invoice: Invoice): Promise<'sent' | 'paid' | 'overdue'> {
    if (!invoice.payableId) {
      return 'sent';
    }
    const payable = await this.payableRepository.findOne({
      where: { id: invoice.payableId },
      select: ['status'],
    });
    if (payable?.status === PayableStatus.PAID) {
      return 'paid';
    }
    return payable?.status === PayableStatus.OVERDUE ? 'overdue' : 'sent';
  }

  /**
   * First open is the one that matters, so `viewed_at` is written once and the
   * counter keeps rising. Raw SQL to avoid touching `updated_at`: a client
   * reading the page is not an edit of the invoice.
   */
  private async recordView(invoice: Invoice): Promise<void> {
    await this.invoiceRepository.query(
      `UPDATE "invoices"
          SET "viewed_at" = COALESCE("viewed_at", now()),
              "view_count" = "view_count" + 1
        WHERE "id" = $1`,
      [invoice.id],
    );
  }
}
