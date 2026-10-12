import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { Repository } from 'typeorm';
import { fromMinor } from '../../common/utils/money.util';
import { Client } from '../../entities/client.entity';
import { CreditNote } from '../../entities/credit-note.entity';
import { CreditNoteApplication } from '../../entities/credit-note-application.entity';
import { CreditNoteLineItem } from '../../entities/credit-note-line-item.entity';
import { Invoice } from '../../entities/invoice.entity';
import { InvoiceLineItem } from '../../entities/invoice-line-item.entity';
import { TaxRateKind } from '../../entities/tax-jurisdiction-rate.entity';
import { VatStatus, Workspace } from '../../entities/workspace.entity';
import type { WorkspaceBusinessProfile } from '../../entities/workspace-business-profile.entity';
import { BusinessProfileService } from '../business-profile/business-profile.service';
import { embeddedInvoiceXml } from '../e-invoices/einvoice-reader';
import {
  missingForXRechnung,
  writeXRechnung,
  type XRechnungCategory,
  type XRechnungInput,
} from '../e-invoices/xrechnung-writer';
import { embedXRechnung } from '../e-invoices/zugferd';
import {
  type LineTaxRate,
  type PricableLine,
  priceLines,
  taxRatesByLineItems,
} from './invoice-pricing';

/** Missing fields, plus what the writer cannot know: a line of a VAT-registered business without a rate. */
export type XRechnungGap = ReturnType<typeof missingForXRechnung>[number] | 'line_tax_rate';

const SMALL_BUSINESS_REASON = 'Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG';
const NOT_REGISTERED_REASON = 'Nicht umsatzsteuerpflichtig';
const REVERSE_CHARGE_REASON = 'Steuerschuldnerschaft des Leistungsempfängers';
const INTRA_EU_REASON = 'Steuerfreie innergemeinschaftliche Lieferung';

const looksLikeIban = (value: string | null) =>
  !!value && /^[A-Z]{2}\d{2}[A-Z0-9 ]{10,40}$/i.test(value.trim());

/**
 * An issued invoice as an XRechnung (EN 16931, CII): the e-invoice German
 * B2B customers must receive from 2027/2028. Built from the stored invoice,
 * the business profile and the client; anything an XRechnung needs that is
 * not filled in is listed instead of producing a file a validator rejects.
 */
@Injectable()
export class InvoiceXRechnungService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly businessProfile: BusinessProfileService,
  ) {}

  /** What the invoice still lacks to be written; empty when it can be. */
  async check(invoiceId: string, workspaceId: string): Promise<{ missing: XRechnungGap[] }> {
    const { missing } = await this.build(invoiceId, workspaceId);
    return { missing };
  }

  /**
   * The XRechnung file; a 400 naming every missing field when it cannot be
   * written. A sent invoice whose PDF carries its XML (ZUGFeRD) gets that XML
   * back unchanged: it is what was issued, whatever was edited since.
   */
  async file(invoiceId: string, workspaceId: string): Promise<{ data: Buffer; fileName: string }> {
    const issued = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .addSelect('invoice.fileData')
      .where('invoice.id = :invoiceId AND invoice.workspaceId = :workspaceId', {
        invoiceId,
        workspaceId,
      })
      .getOne();
    const embedded = issued?.fileData ? await embeddedInvoiceXml(issued.fileData) : null;
    if (issued && embedded) {
      return { data: Buffer.from(embedded, 'utf8'), fileName: xmlFileName(issued.invoiceNumber) };
    }
    const { input, missing } = await this.build(invoiceId, workspaceId);
    return fileOf(input, missing);
  }

  /**
   * The invoice PDF as a ZUGFeRD hybrid (PDF/A-3 with the XRechnung inside)
   * when the business is German and the XRechnung can be written; the PDF as
   * it is otherwise. Runs inside the send, so it reads that transaction's
   * invoice number.
   */
  async invoiceHybridPdf(manager: EntityManager, invoice: Invoice, pdf: Buffer): Promise<Buffer> {
    return hybridOf(await this.invoiceInput(manager, invoice), pdf);
  }

  /** The same for a credit note, inside the transaction that issues it. */
  async creditNoteHybridPdf(
    manager: EntityManager,
    note: CreditNote,
    pdf: Buffer,
  ): Promise<Buffer> {
    return hybridOf(await this.creditNoteInput(manager, note), pdf);
  }

  /**
   * The XRechnung to attach to the e-mail of a German business's invoice,
   * when it can be written; NULL otherwise, and the PDF goes alone.
   */
  async attachmentFor(
    invoiceId: string,
    workspaceId: string,
  ): Promise<{ filename: string; content: Buffer; contentType: string } | null> {
    const { input, missing, sellerCountry } = await this.build(invoiceId, workspaceId);
    if (sellerCountry !== 'DE' || missing.length > 0) {
      return null;
    }
    return {
      filename: `${(input.number ?? 'invoice').replace(/[^\w.-]+/g, '_')}.xml`,
      content: Buffer.from(writeXRechnung(input), 'utf8'),
      contentType: 'application/xml',
    };
  }

  private async build(invoiceId: string, workspaceId: string) {
    return this.invoiceRepository.manager.transaction(async manager => {
      const invoice = await manager.findOne(Invoice, { where: { id: invoiceId, workspaceId } });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      return this.invoiceInput(manager, invoice);
    });
  }

  private async invoiceInput(manager: EntityManager, invoice: Invoice) {
    const { workspaceId } = invoice;
    const invoiceId = invoice.id;
    const [client, profile, workspace, lineItems] = await Promise.all([
      manager.findOne(Client, {
        where: { id: invoice.clientId, workspaceId },
        withDeleted: true,
      }),
      this.businessProfile.get(workspaceId),
      this.workspaceRepository.findOne({ where: { id: workspaceId } }),
      manager.find(InvoiceLineItem, { where: { invoiceId }, order: { sortOrder: 'ASC' } }),
    ]);
    const { lines, untaxed } = await this.linesOf(
      manager,
      invoice.pricesIncludeTax,
      lineItems,
      client,
      workspace?.vatStatus ?? VatStatus.REGISTERED,
    );
    const input: XRechnungInput = {
      number: invoice.invoiceNumber,
      issueDate: String(invoice.issueDate).slice(0, 10),
      dueDate: invoice.dueDate ? String(invoice.dueDate).slice(0, 10) : null,
      deliveryDate: invoice.deliveryDate ? String(invoice.deliveryDate).slice(0, 10) : null,
      currency: invoice.currency,
      buyerReference: invoice.buyerReference || client?.buyerReference || null,
      note: invoice.notes,
      seller: sellerOf(profile),
      buyer: buyerOf(client),
      lines,
    };
    return outcome(input, untaxed, profile);
  }

  /** What a credit note still lacks to be written as an XRechnung (type 381). */
  async checkCreditNote(id: string, workspaceId: string): Promise<{ missing: XRechnungGap[] }> {
    const { missing } = await this.buildCreditNote(id, workspaceId);
    return { missing };
  }

  /** The credit note as an XRechnung (type 381) naming the invoice it corrects. */
  async creditNoteFile(
    id: string,
    workspaceId: string,
  ): Promise<{ data: Buffer; fileName: string }> {
    const { input, missing } = await this.buildCreditNote(id, workspaceId);
    return fileOf(input, missing);
  }

  private async buildCreditNote(id: string, workspaceId: string) {
    return this.invoiceRepository.manager.transaction(async manager => {
      const note = await manager.findOne(CreditNote, { where: { id, workspaceId } });
      if (!note) {
        throw new NotFoundException('Credit note not found');
      }
      return this.creditNoteInput(manager, note);
    });
  }

  private async creditNoteInput(manager: EntityManager, note: CreditNote) {
    const { id, workspaceId } = note;
    const [client, profile, workspace, lineItems, application] = await Promise.all([
      manager.findOne(Client, { where: { id: note.clientId, workspaceId }, withDeleted: true }),
      this.businessProfile.get(workspaceId),
      this.workspaceRepository.findOne({ where: { id: workspaceId } }),
      manager.find(CreditNoteLineItem, {
        where: { creditNoteId: id },
        order: { sortOrder: 'ASC' },
      }),
      manager.findOne(CreditNoteApplication, {
        where: { creditNoteId: id, workspaceId },
        relations: { invoice: true },
        order: { createdAt: 'ASC' },
      }),
    ]);
    const credited = application?.invoice ?? null;
    const { lines, untaxed } = await this.linesOf(
      manager,
      note.pricesIncludeTax,
      lineItems,
      client,
      workspace?.vatStatus ?? VatStatus.REGISTERED,
    );
    const input: XRechnungInput = {
      typeCode: '381',
      precedingInvoice: credited?.invoiceNumber
        ? { number: credited.invoiceNumber, issueDate: String(credited.issueDate).slice(0, 10) }
        : null,
      number: note.creditNoteNumber,
      issueDate: String(note.issueDate).slice(0, 10),
      dueDate: null,
      deliveryDate: credited?.deliveryDate ? String(credited.deliveryDate).slice(0, 10) : null,
      currency: note.currency,
      buyerReference: credited?.buyerReference || client?.buyerReference || null,
      note: note.reason,
      seller: sellerOf(profile),
      buyer: buyerOf(client),
      lines,
    };
    return outcome(input, untaxed, profile);
  }

  /** Each line's net, VAT category and rate, as the invoice priced it. */
  private async linesOf(
    manager: EntityManager,
    pricesIncludeTax: boolean,
    lineItems: Array<PricableLine & { unitCode?: string | null }>,
    client: Client | null,
    vatStatus: VatStatus,
  ): Promise<{ lines: XRechnungInput['lines']; untaxed: boolean }> {
    const rateById = await taxRatesByLineItems(manager, lineItems);
    const priced = await priceLines(manager, lineItems, pricesIncludeTax);
    // The same lines without their discounts or surcharges: the difference in
    // net is the adjustment the e-invoice states, also for tax-inclusive prices.
    const unadjusted = await priceLines(
      manager,
      lineItems.map(item => ({ ...item, adjustmentPercent: null })),
      pricesIncludeTax,
    );
    let untaxed = false;
    const lines = lineItems.map((item, index) => {
      const rate = item.taxRateId ? rateById.get(item.taxRateId) : undefined;
      const { category, percent, reason } = categoryOf(rate, client, vatStatus);
      if (!rate && vatStatus === VatStatus.REGISTERED) {
        untaxed = true;
      }
      return {
        name: item.description,
        quantity: Number(item.quantity),
        unitCode: item.unitCode || 'C62',
        net: fromMinor(priced[index].netMinor),
        adjustment: Number(item.adjustmentPercent ?? 0)
          ? {
              percent: Number(item.adjustmentPercent),
              amount: fromMinor(priced[index].netMinor - unadjusted[index].netMinor),
            }
          : null,
        category,
        rate: percent,
        exemptionReason: reason,
      };
    });
    return { lines, untaxed };
  }
}

function outcome(input: XRechnungInput, untaxed: boolean, profile: WorkspaceBusinessProfile) {
  const missing: XRechnungGap[] = [...missingForXRechnung(input)];
  if (untaxed) {
    missing.push('line_tax_rate');
  }
  return { input, missing, sellerCountry: profile.countryCode?.toUpperCase() ?? null };
}

const xmlFileName = (number: string | null) =>
  `${(number ?? 'invoice').replace(/[^\w.-]+/g, '_')}.xml`;

/** The PDF with its XRechnung embedded, for a German business whose XRechnung is complete. */
async function hybridOf(
  { input, missing, sellerCountry }: ReturnType<typeof outcome>,
  pdf: Buffer,
): Promise<Buffer> {
  if (sellerCountry !== 'DE' || missing.length > 0) {
    return pdf;
  }
  return embedXRechnung(pdf, writeXRechnung(input), {
    title: input.number ?? '',
    date: new Date(),
  });
}

/** The file, or a 400 naming every missing field. */
function fileOf(
  input: XRechnungInput,
  missing: XRechnungGap[],
): { data: Buffer; fileName: string } {
  if (missing.length > 0) {
    throw new BadRequestException({
      code: 'XRECHNUNG_INCOMPLETE',
      message: 'The document lacks what an XRechnung requires',
      missing,
    });
  }
  return {
    data: Buffer.from(writeXRechnung(input), 'utf8'),
    fileName: xmlFileName(input.number),
  };
}

function buyerOf(client: Client | null): XRechnungInput['buyer'] {
  return {
    name: client?.name ?? null,
    street: client?.street ?? null,
    postalCode: client?.postalCode ?? null,
    city: client?.city ?? null,
    countryCode: client?.countryCode ?? null,
    vatId: client?.taxId ?? null,
    email: client?.email ?? null,
  };
}

function sellerOf(profile: WorkspaceBusinessProfile): XRechnungInput['seller'] {
  return {
    name: profile.legalName,
    street: profile.street,
    postalCode: profile.postalCode,
    city: profile.city,
    countryCode: profile.countryCode,
    vatId: profile.taxId,
    email: profile.email,
    taxNumber: profile.taxNumber,
    registrationId: profile.registrationId,
    contactName: profile.contactName,
    phone: profile.phone,
    // SEPA credit transfer needs an IBAN; a local account number is no use here.
    iban: looksLikeIban(profile.bankAccount) ? profile.bankAccount : null,
    bic: profile.bankCode,
  };
}

/**
 * The UNCL 5305 category of a line: a reverse-charged rate is a § 13b
 * service (AE) or, for a client supplied with goods, an intra-Community
 * supply (K); an exempt or zero rate says so; a line without a rate is the
 * small business's (§ 19) or an unregistered seller's.
 */
function categoryOf(
  rate: LineTaxRate | undefined,
  client: Client | null,
  vatStatus: VatStatus,
): { category: XRechnungCategory; percent: number; reason: string | null } {
  if (rate?.isReverseCharge) {
    return client?.supplyType === 'goods'
      ? { category: 'K', percent: 0, reason: INTRA_EU_REASON }
      : { category: 'AE', percent: 0, reason: REVERSE_CHARGE_REASON };
  }
  if (rate?.kind === TaxRateKind.EXEMPT) {
    return { category: 'E', percent: 0, reason: rate.name };
  }
  if (rate && (rate.kind === TaxRateKind.ZERO || rate.rate === 0)) {
    return { category: 'Z', percent: 0, reason: null };
  }
  if (rate) {
    return { category: 'S', percent: rate.rate, reason: null };
  }
  return {
    category: 'E',
    percent: 0,
    reason: vatStatus === VatStatus.SMALL_BUSINESS ? SMALL_BUSINESS_REASON : NOT_REGISTERED_REASON,
  };
}
