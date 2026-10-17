import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { decryptText, encryptText } from '../../common/utils/encryption.util';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import { CreditNoteStatus } from '../../entities/credit-note.entity';
import { InvoiceStatus } from '../../entities/invoice.entity';
import { PeppolConnection } from '../../entities/peppol-connection.entity';
import { PeppolInboundDocument } from '../../entities/peppol-inbound-document.entity';
import {
  type PeppolDeliveryStatus,
  type PeppolFormat,
  PeppolTransmission,
} from '../../entities/peppol-transmission.entity';
import { ReceiptSource } from '../../entities/receipt.entity';
import { Workspace } from '../../entities/workspace.entity';
import {
  formatPeppolId,
  LEITWEG_SCHEME,
  parsePeppolId,
  suggestPeppolId,
} from '../e-invoices/peppol-id';
import { missingForPeppol, PEPPOL_DOCTYPES, writePeppolUbl } from '../e-invoices/peppol-ubl-writer';
import {
  missingForXRechnung,
  writeXRechnung,
  type XRechnungInput,
} from '../e-invoices/xrechnung-writer';
import { InvoiceXRechnungService } from '../invoices/invoice-xrechnung.service';
import { ReceiptsService } from '../receipts/receipts.service';
import {
  failureText,
  RecommandClient,
  type RecommandCompany,
  type RecommandCredentials,
} from './recommand.client';

export type PeppolDocumentKind = 'invoice' | 'credit_note';

/** The shape the integrations page reads for every protocol integration. */
export interface PeppolConnectionStatus {
  connected: boolean;
  status: 'connected' | 'disconnected';
  settings: {
    apiKeyId: string | null;
    companyId: string | null;
    companyName: string | null;
    senderPeppolId: string | null;
    lastPolledAt: string | null;
    lastError: string | null;
  };
}

export interface PeppolTransmissionView {
  id: string;
  recipient: string;
  format: PeppolFormat;
  status: PeppolDeliveryStatus;
  failure: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PeppolLookup {
  registered: boolean;
  companyName: string | null;
  formats: PeppolFormat[];
}

/** Recommand's document types (on an incoming document) Lumio takes in as a receipt. */
const RECEIVABLE_TYPES = new Set(['invoice', 'creditNote']);

/** The formats Lumio writes, by the document type id a recipient registers. */
function formatsOf(docTypeIds: readonly string[], kind: PeppolDocumentKind): PeppolFormat[] {
  const formats: PeppolFormat[] = [];
  if (
    docTypeIds.includes(
      kind === 'invoice' ? PEPPOL_DOCTYPES.bisInvoice : PEPPOL_DOCTYPES.bisCreditNote,
    )
  ) {
    formats.push('peppol_bis');
  }
  // One CII document type carries both: the credit note is type 381 inside.
  if (docTypeIds.includes(PEPPOL_DOCTYPES.xrechnungCii)) {
    formats.push('xrechnung_cii');
  }
  return formats;
}

/**
 * Peppol through the workspace's own access point account (Recommand).
 *
 * Sending: the recipient is looked up first and the document is written in
 * a format it registered — XRechnung (CII) preferred for a German seller,
 * since that is the German e-invoice, Peppol BIS 3.0 (UBL) otherwise. Lumio
 * writes and validates the XML itself and the access point only carries it,
 * so what was sent is stored with the transmission.
 *
 * Receiving: the access point's inbox is polled (a self-hosted Lumio often
 * has no public address for webhooks); each e-invoice becomes a receipt
 * through the same reader as an uploaded XRechnung.
 */
@Injectable()
export class PeppolService {
  private readonly logger = new Logger(PeppolService.name);

  constructor(
    @InjectRepository(PeppolConnection)
    private readonly connections: Repository<PeppolConnection>,
    @InjectRepository(PeppolTransmission)
    private readonly transmissions: Repository<PeppolTransmission>,
    @InjectRepository(PeppolInboundDocument)
    private readonly inbound: Repository<PeppolInboundDocument>,
    @InjectRepository(Workspace)
    private readonly workspaces: Repository<Workspace>,
    private readonly recommand: RecommandClient,
    private readonly xrechnung: InvoiceXRechnungService,
    private readonly receipts: ReceiptsService,
  ) {}

  // ── Connection ───────────────────────────────────────────────────────────

  async status(workspaceId: string): Promise<PeppolConnectionStatus> {
    const connection = await this.connections.findOne({ where: { workspaceId } });
    return {
      connected: Boolean(connection),
      status: connection ? 'connected' : 'disconnected',
      settings: {
        apiKeyId: connection?.apiKeyId ?? null,
        companyId: connection?.companyId ?? null,
        companyName: connection?.companyName ?? null,
        senderPeppolId: connection?.senderPeppolId ?? null,
        lastPolledAt: connection?.lastPolledAt?.toISOString() ?? null,
        lastError: connection?.lastError ?? null,
      },
    };
  }

  /**
   * Saves the key after the access point accepted it. The company is the
   * one named, or the only one the account has; the sender's Peppol id is
   * the one given, or the company's registered identifier, or its VAT id's.
   * A blank secret keeps the stored one, so changing the company does not
   * need the secret again.
   */
  async connect(
    workspaceId: string,
    input: {
      apiKeyId?: string | null;
      apiSecret?: string | null;
      companyId?: string | null;
      senderPeppolId?: string | null;
    },
  ): Promise<PeppolConnectionStatus> {
    const existing = await this.withSecret(workspaceId);
    const apiKeyId = input.apiKeyId?.trim() || existing?.apiKeyId;
    const apiSecret = input.apiSecret?.trim() || (existing ? decryptText(existing.apiSecret) : '');
    if (!(apiKeyId && apiSecret)) {
      throw new BadRequestException(appError('PEPPOL_AUTH_FAILED'));
    }
    const credentials = { apiKeyId, apiSecret };
    await this.recommand.verifyAuth(credentials);
    const company = this.pickCompany(
      await this.recommand.companies(credentials),
      input.companyId?.trim() || existing?.companyId,
    );
    const sender = this.senderIdOf(company, input.senderPeppolId);

    await this.connections.upsert(
      {
        workspaceId,
        provider: 'recommand',
        apiKeyId,
        apiSecret: encryptText(apiSecret),
        companyId: company.id,
        companyName: company.name,
        senderPeppolId: sender,
        lastError: null,
      },
      ['workspaceId'],
    );
    return this.status(workspaceId);
  }

  async disconnect(workspaceId: string): Promise<{ ok: true }> {
    await this.connections.delete({ workspaceId });
    return { ok: true };
  }

  private pickCompany(
    companies: readonly RecommandCompany[],
    companyId: string | null | undefined,
  ): RecommandCompany {
    if (companyId) {
      const company = companies.find(item => item.id === companyId);
      if (!company) {
        throw new BadRequestException(appError('PEPPOL_COMPANY_NOT_FOUND'));
      }
      return company;
    }
    if (companies.length === 0) {
      throw new BadRequestException(appError('PEPPOL_COMPANY_MISSING'));
    }
    if (companies.length > 1) {
      throw new BadRequestException(
        appError('PEPPOL_COMPANY_REQUIRED', {
          companies: companies.map(item => `${item.name}: ${item.id}`).join(', '),
        }),
      );
    }
    return companies[0];
  }

  private senderIdOf(company: RecommandCompany, given: string | null | undefined): string {
    const registered =
      company.enterpriseNumberScheme && company.enterpriseNumber
        ? `${company.enterpriseNumberScheme}:${company.enterpriseNumber}`
        : null;
    const candidate = given?.trim() || registered || suggestPeppolId(company.vatNumber);
    const id = parsePeppolId(candidate);
    if (!id) {
      throw new BadRequestException(appError('PEPPOL_ID_INVALID'));
    }
    return formatPeppolId(id);
  }

  private async withSecret(workspaceId: string): Promise<PeppolConnection | null> {
    return this.connections
      .createQueryBuilder('connection')
      .addSelect('connection.apiSecret')
      .where('connection.workspaceId = :workspaceId', { workspaceId })
      .getOne();
  }

  private async requireConnection(
    workspaceId: string,
  ): Promise<{ connection: PeppolConnection; credentials: RecommandCredentials }> {
    const connection = await this.withSecret(workspaceId);
    if (!connection) {
      throw new BadRequestException(appError('PEPPOL_NOT_CONNECTED'));
    }
    return {
      connection,
      credentials: { apiKeyId: connection.apiKeyId, apiSecret: decryptText(connection.apiSecret) },
    };
  }

  // ── Recipients ───────────────────────────────────────────────────────────

  /** Whether a Peppol id is on the network, and which of Lumio's formats it takes. */
  async lookup(workspaceId: string, peppolId: string): Promise<PeppolLookup> {
    const id = parsePeppolId(peppolId);
    if (!id) {
      throw new BadRequestException(appError('PEPPOL_ID_INVALID'));
    }
    const { credentials } = await this.requireConnection(workspaceId);
    const result = await this.recommand.verify(credentials, formatPeppolId(id));
    const docTypeIds = (result.supportedDocuments ?? []).map(item => item.docTypeId);
    const formats = [
      ...new Set([...formatsOf(docTypeIds, 'invoice'), ...formatsOf(docTypeIds, 'credit_note')]),
    ];
    return { registered: result.isValid, companyName: result.companyName ?? null, formats };
  }

  // ── Sending ──────────────────────────────────────────────────────────────

  async send(
    workspaceId: string,
    userId: string,
    kind: PeppolDocumentKind,
    documentId: string,
  ): Promise<PeppolTransmissionView> {
    const { connection, credentials } = await this.requireConnection(workspaceId);
    const document = await this.xrechnung.documentFor(kind, documentId, workspaceId);
    const issued =
      kind === 'invoice'
        ? document.status !== InvoiceStatus.DRAFT && document.status !== InvoiceStatus.VOID
        : document.status === CreditNoteStatus.ISSUED;
    if (!issued) {
      throw new BadRequestException(appError('PEPPOL_NOT_ISSUED'));
    }
    const input: XRechnungInput = {
      ...document.input,
      seller: { ...document.input.seller, peppolId: connection.senderPeppolId },
    };
    const recipient = recipientOf(input);
    const accepted = await this.acceptedFormats(credentials, recipient, kind);
    const { format, xml } = this.write(input, accepted, document.sellerCountry, recipient);
    const docTypeId =
      format === 'xrechnung_cii'
        ? PEPPOL_DOCTYPES.xrechnungCii
        : kind === 'invoice'
          ? PEPPOL_DOCTYPES.bisInvoice
          : PEPPOL_DOCTYPES.bisCreditNote;

    // The row first: the partial unique index turns a second send of the same
    // document into a conflict before anything reaches the network.
    const transmission = await this.transmissions
      .save(
        this.transmissions.create({
          workspaceId,
          invoiceId: kind === 'invoice' ? documentId : null,
          creditNoteId: kind === 'credit_note' ? documentId : null,
          recipient,
          format,
          docTypeId,
          documentXml: xml,
          status: 'pending',
          sentById: userId,
        }),
      )
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === '23505') {
          throw new ConflictException(appError('PEPPOL_ALREADY_SENT'));
        }
        throw error;
      });
    await this.transmit(credentials, connection.companyId, transmission);
    return viewOf(transmission);
  }

  /** The document types a recipient registered, as the formats Lumio writes. */
  private async acceptedFormats(
    credentials: RecommandCredentials,
    recipient: string,
    kind: PeppolDocumentKind,
  ): Promise<PeppolFormat[]> {
    const verification = await this.recommand.verify(credentials, recipient);
    if (!verification.isValid) {
      throw new BadRequestException(appError('PEPPOL_RECIPIENT_UNKNOWN', { recipient }));
    }
    return formatsOf(
      (verification.supportedDocuments ?? []).map(item => item.docTypeId),
      kind,
    );
  }

  /** Hands the stored XML to the access point and records what it said. */
  private async transmit(
    credentials: RecommandCredentials,
    companyId: string,
    transmission: PeppolTransmission,
  ): Promise<void> {
    try {
      const sent = await this.recommand.sendXml(credentials, companyId, {
        recipient: transmission.recipient,
        doctypeId: transmission.docTypeId,
        xml: transmission.documentXml,
      });
      transmission.providerDocumentId = sent.id;
      transmission.status = deliveryStatusOf(sent.deliveryStatus);
      transmission.failure = firstFailure(sent.deliveries);
    } catch (error) {
      transmission.status = 'failed';
      // A refusal means nothing was sent. A timeout or an unreachable access
      // point leaves it open whether the document went out, and says so.
      const status = (error as { getStatus?: () => number }).getStatus?.();
      transmission.failure =
        status === 502
          ? 'The access point did not answer; check its dashboard before sending again.'
          : (error as Error).message;
      await this.transmissions.save(transmission);
      throw error;
    }
    await this.transmissions.save(transmission);
  }

  /**
   * The document in the first format the recipient takes that Lumio can
   * write for it; an error that names what is missing when it takes one but
   * the document lacks something, or none at all.
   */
  private write(
    input: XRechnungInput,
    accepted: PeppolFormat[],
    sellerCountry: string | null,
    recipient: string,
  ): { format: PeppolFormat; xml: string } {
    const preference: PeppolFormat[] =
      sellerCountry === 'DE' ? ['xrechnung_cii', 'peppol_bis'] : ['peppol_bis', 'xrechnung_cii'];
    const usable = preference.filter(format => accepted.includes(format));
    if (usable.length === 0) {
      throw new BadRequestException(appError('PEPPOL_RECIPIENT_FORMAT', { recipient }));
    }
    const gaps: string[][] = [];
    for (const format of usable) {
      const missing: string[] =
        format === 'xrechnung_cii' ? missingForXRechnung(input) : missingForPeppol(input);
      if (missing.length === 0) {
        return {
          format,
          xml: format === 'xrechnung_cii' ? writeXRechnung(input) : writePeppolUbl(input),
        };
      }
      gaps.push(missing);
    }
    throw new BadRequestException({
      ...appError('PEPPOL_DOCUMENT_INCOMPLETE'),
      missing: gaps[0],
    });
  }

  /** What was sent for a document, newest first; pending deliveries are asked about again. */
  async transmissionsFor(
    workspaceId: string,
    kind: PeppolDocumentKind,
    documentId: string,
  ): Promise<PeppolTransmissionView[]> {
    const rows = await this.transmissions.find({
      where:
        kind === 'invoice'
          ? { workspaceId, invoiceId: documentId }
          : { workspaceId, creditNoteId: documentId },
      order: { createdAt: 'DESC' },
    });
    if (rows.some(row => row.status === 'pending' && row.providerDocumentId)) {
      await this.refreshWorkspace(workspaceId, rows).catch((error: unknown) =>
        this.logger.warn(`Peppol status refresh failed: ${(error as Error).message}`),
      );
    }
    return rows.map(viewOf);
  }

  /** The XML exactly as it was sent. */
  async sentDocument(
    workspaceId: string,
    transmissionId: string,
  ): Promise<{ data: Buffer; fileName: string }> {
    const row = await this.transmissions
      .createQueryBuilder('transmission')
      .addSelect('transmission.documentXml')
      .where('transmission.id = :transmissionId AND transmission.workspaceId = :workspaceId', {
        transmissionId,
        workspaceId,
      })
      .getOne();
    if (!row) {
      throw new NotFoundException('Peppol transmission not found');
    }
    return {
      data: Buffer.from(row.documentXml, 'utf8'),
      fileName: `peppol-${row.format}-${row.id.slice(0, 8)}.xml`,
    };
  }

  private async refreshWorkspace(workspaceId: string, rows: PeppolTransmission[]): Promise<void> {
    const { credentials } = await this.requireConnection(workspaceId);
    for (const row of rows) {
      if (row.status !== 'pending' || !row.providerDocumentId) {
        continue;
      }
      const document = await this.recommand.document(credentials, row.providerDocumentId);
      const status = deliveryStatusOf(document.deliveryStatus);
      if (status !== row.status) {
        row.status = status;
        row.failure = status === 'failed' ? firstFailure(document.deliveries) : null;
        await this.transmissions.save(row);
      }
    }
  }

  /** Delivery is confirmed after the send answers; pending ones are asked about every ten minutes. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshPending(): Promise<void> {
    // A past version keeps the statuses it was copied with.
    const pending = await this.transmissions.find({
      where: {
        status: 'pending',
        providerDocumentId: Not(IsNull()),
        workspace: STANDARD_WORKSPACE,
      },
    });
    const byWorkspace = new Map<string, PeppolTransmission[]>();
    for (const row of pending) {
      byWorkspace.set(row.workspaceId, [...(byWorkspace.get(row.workspaceId) ?? []), row]);
    }
    for (const [workspaceId, rows] of byWorkspace) {
      await this.refreshWorkspace(workspaceId, rows).catch((error: unknown) =>
        this.logger.warn(
          `Peppol status refresh failed for workspace ${workspaceId}: ${(error as Error).message}`,
        ),
      );
    }
  }

  // ── Receiving ────────────────────────────────────────────────────────────

  /**
   * Takes every unread incoming invoice and credit note in as a receipt,
   * then marks it read at the access point. Anything else in the inbox
   * (message level responses) is marked read and left there.
   */
  async poll(workspaceId: string, userId?: string): Promise<{ imported: number }> {
    const { connection, credentials } = await this.requireConnection(workspaceId);
    const owner =
      userId ?? (await this.workspaces.findOne({ where: { id: workspaceId } }))?.ownerId ?? null;
    if (!owner) {
      return { imported: 0 };
    }
    let imported = 0;
    try {
      const entries = await this.recommand.inbox(credentials, connection.companyId);
      for (const entry of entries) {
        if (await this.takeIn(workspaceId, owner, credentials, entry)) {
          imported += 1;
        }
      }
      await this.connections.update({ workspaceId }, { lastPolledAt: new Date(), lastError: null });
    } catch (error) {
      await this.connections.update(
        { workspaceId },
        { lastPolledAt: new Date(), lastError: (error as Error).message },
      );
      throw error;
    }
    return { imported };
  }

  private async takeIn(
    workspaceId: string,
    userId: string,
    credentials: RecommandCredentials,
    entry: { id: string; type?: string | null; senderId?: string | null },
  ): Promise<boolean> {
    if (!RECEIVABLE_TYPES.has(entry.type ?? '')) {
      await this.recommand.markAsRead(credentials, entry.id);
      return false;
    }
    // Claimed before the work: a document that was taken in, but whose
    // mark-as-read was lost, is only marked read the next time round.
    const claim = await this.inbound
      .insert({ workspaceId, providerDocumentId: entry.id, senderPeppolId: entry.senderId ?? null })
      .then(() => true)
      .catch((error: unknown) => {
        if ((error as { code?: string }).code === '23505') {
          return false;
        }
        throw error;
      });
    if (!claim) {
      await this.recommand.markAsRead(credentials, entry.id);
      return false;
    }
    try {
      const document = await this.recommand.document(credentials, entry.id);
      if (!document.xml) {
        throw new Error(`Peppol document ${entry.id} came without its XML`);
      }
      const receipt = await this.receipts.createFromScan({
        userId,
        workspaceId,
        file: await this.storeXml(document.xml, entry.id),
        source: ReceiptSource.PEPPOL,
      });
      await this.inbound.update(
        { workspaceId, providerDocumentId: entry.id },
        { receiptId: receipt.id },
      );
    } catch (error) {
      // Released, so the next poll tries again.
      await this.inbound.delete({ workspaceId, providerDocumentId: entry.id });
      throw error;
    }
    await this.recommand.markAsRead(credentials, entry.id);
    return true;
  }

  /** The XML as an uploaded file, where receipts keep theirs. */
  private async storeXml(xml: string, providerDocumentId: string): Promise<Express.Multer.File> {
    const directory = path.join(
      process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
      'peppol',
    );
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.xml`;
    const target = path.join(directory, filename);
    const buffer = Buffer.from(xml, 'utf8');
    await writeFile(target, buffer);
    return {
      fieldname: 'file',
      originalname: `peppol-${providerDocumentId}.xml`,
      encoding: '7bit',
      mimetype: 'application/xml',
      size: buffer.length,
      destination: directory,
      filename,
      path: target,
      buffer,
    } as Express.Multer.File;
  }

  /** Every connected workspace's inbox, every ten minutes. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async pollAll(): Promise<void> {
    // A past version takes nothing in: documents arriving now belong to the live workspace.
    const connected = await this.connections.find({
      where: { workspace: STANDARD_WORKSPACE },
      select: { workspaceId: true },
    });
    for (const { workspaceId } of connected) {
      await this.poll(workspaceId).catch((error: unknown) =>
        this.logger.warn(
          `Peppol inbox poll failed for workspace ${workspaceId}: ${(error as Error).message}`,
        ),
      );
    }
  }
}

/**
 * The buyer's Peppol id; a public authority addressed by Leitweg-ID also
 * needs it as the buyer reference, or the federal portal rejects the invoice.
 */
function recipientOf(input: XRechnungInput): string {
  const id = parsePeppolId(input.buyer.peppolId);
  if (!id) {
    throw new BadRequestException({
      ...appError('PEPPOL_DOCUMENT_INCOMPLETE'),
      missing: ['buyer_peppol_id'],
    });
  }
  if (
    id.scheme === LEITWEG_SCHEME &&
    input.buyerReference?.trim().toUpperCase() !== id.value.toUpperCase()
  ) {
    throw new BadRequestException(appError('PEPPOL_LEITWEG_MISMATCH', { leitweg: id.value }));
  }
  return formatPeppolId(id);
}

function deliveryStatusOf(status: string | null | undefined): PeppolDeliveryStatus {
  return status === 'delivered' || status === 'failed' ? status : 'pending';
}

function firstFailure(
  deliveries: ReadonlyArray<{ status?: string | null; failure?: unknown }> | undefined,
): string | null {
  const failed = deliveries?.find(item => item.status === 'failed');
  return failed ? (failureText(failed.failure) ?? 'Delivery failed') : null;
}

function viewOf(row: PeppolTransmission): PeppolTransmissionView {
  return {
    id: row.id,
    recipient: row.recipient,
    format: row.format,
    status: row.status,
    failure: row.failure,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
