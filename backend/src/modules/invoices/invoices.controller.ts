import { Controller, Delete, Get, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { withoutNulls } from '../../common/effect/without-nulls';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  AgeingReport,
  CreateInvoiceBody,
  CreditNoteList,
  Invoice,
  InvoiceClientParams,
  InvoiceCreated,
  InvoiceDelivery,
  InvoiceDeliveryList,
  InvoiceListPage,
  InvoiceParams,
  InvoiceSettings,
  InvoicesQuery,
  LateFeeQuote,
  MessageResult,
  SendInvoiceEmailBody,
  UpdateInvoiceBody,
  UpdateInvoiceSettingsBody,
  XRechnungCheck,
} from '../../contracts';
import { InvoiceWritten } from '../../contracts/invoices/invoice-writes';
import { EntityType } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreditNotesService } from './credit-notes.service';
import { InvoiceAgeingService } from './invoice-ageing.service';
import { InvoiceDeliveryService } from './invoice-delivery.service';
import { InvoiceSettingsService } from './invoice-settings.service';
import { InvoiceXRechnungService } from './invoice-xrechnung.service';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoiceDeliveryService: InvoiceDeliveryService,
    private readonly invoiceSettingsService: InvoiceSettingsService,
    private readonly invoiceAgeingService: InvoiceAgeingService,
    private readonly creditNotesService: CreditNotesService,
    private readonly xrechnungService: InvoiceXRechnungService,
  ) {}

  @Post()
  @WorkspaceAuth(Permission.INVOICE_CREATE)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: true, isUndoable: true })
  @SchemaResponse(InvoiceCreated)
  async create(
    @SchemaBody(CreateInvoiceBody) dto: CreateInvoiceBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoicesService.create(workspaceId, dto);
  }

  @Get()
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  @SchemaResponse(InvoiceListPage)
  async findAll(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(InvoicesQuery) query: InvoicesQuery,
  ) {
    return this.invoicesService.findAll(workspaceId, query);
  }

  @Get('settings')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  @SchemaResponse(InvoiceSettings)
  async getSettings(@WorkspaceId() workspaceId: string): Promise<InvoiceSettings> {
    const [numbering, settings] = await Promise.all([
      this.invoicesService.getNumberingSettings(workspaceId),
      this.invoiceSettingsService.get(workspaceId),
    ]);
    return { ...numbering, ...settings };
  }

  @Put('settings')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  @SchemaResponse(InvoiceSettings)
  async updateSettings(
    @SchemaBody(UpdateInvoiceSettingsBody) dto: UpdateInvoiceSettingsBody,
    @WorkspaceId() workspaceId: string,
  ) {
    const numbering =
      dto.prefix == null
        ? await this.invoicesService.getNumberingSettings(workspaceId)
        : await this.invoicesService.updateNumberPrefix(workspaceId, dto.prefix);
    const settings = await this.invoiceSettingsService.update(workspaceId, withoutNulls(dto));
    return { ...numbering, ...settings };
  }

  @Get('ageing')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  @SchemaResponse(AgeingReport)
  async ageing(@WorkspaceId() workspaceId: string) {
    return this.invoiceAgeingService.report(workspaceId);
  }

  /** What a late fee would come to for this client, at the workspace's percent. */
  @Get('clients/:clientId/late-fee')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  @SchemaResponse(LateFeeQuote)
  async lateFee(
    @SchemaParams(InvoiceClientParams) { clientId }: InvoiceClientParams,
    @WorkspaceId() workspaceId: string,
  ): Promise<LateFeeQuote> {
    const [{ lateFeePercent }, overdue] = await Promise.all([
      this.invoiceSettingsService.get(workspaceId),
      this.invoiceAgeingService.overdueByCurrency(workspaceId, clientId),
    ]);
    return {
      percent: lateFeePercent,
      amounts: overdue.map(row => ({
        currency: row.currency,
        overdue: row.amount,
        fee: Math.round(((row.amount * lateFeePercent) / 100) * 100) / 100,
      })),
    };
  }

  @Get(':id')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  @SchemaResponse(Invoice)
  async findOne(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoicesService.findOne(id, workspaceId);
  }

  /** The credit notes raised against this invoice. */
  @Get(':id/credit-notes')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  @SchemaResponse(CreditNoteList)
  async creditNotes(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.creditNotesService.findForInvoice(id, workspaceId);
  }

  @Get(':id/pdf')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async downloadPdf(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { fileName, data } = await this.invoicesService.getPdf(id, workspaceId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.send(data);
  }

  /**
   * The issued invoice as an XRechnung (EN 16931, CII), the e-invoice German
   * B2B customers must accept. A 400 lists what is missing for it.
   */
  @Get(':id/xrechnung')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async downloadXRechnung(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { fileName, data } = await this.xrechnungService.file(id, workspaceId);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.send(data);
  }

  /** What the invoice, its client or the business profile still lack for an XRechnung. */
  @Get(':id/xrechnung/check')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  @SchemaResponse(XRechnungCheck)
  async checkXRechnung(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.xrechnungService.check(id, workspaceId);
  }

  @Get(':id/preview')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async previewPdf(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { fileName, data } = await this.invoicesService.previewPdf(id, workspaceId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildContentDisposition('inline', fileName));
    res.send(data);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: true, isUndoable: true })
  @SchemaResponse(InvoiceWritten)
  async update(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @SchemaBody(UpdateInvoiceBody) dto: UpdateInvoiceBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoicesService.update(id, workspaceId, dto);
  }

  @Put(':id/send')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: true, isUndoable: false })
  @SchemaResponse(InvoiceWritten)
  async send(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoicesService.send(id, workspaceId, user.id);
  }

  @Post(':id/deliveries')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: false, isUndoable: false })
  @SchemaResponse(InvoiceDelivery)
  async emailInvoice(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @SchemaBody(SendInvoiceEmailBody) dto: SendInvoiceEmailBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoiceDeliveryService.sendEmail(id, workspaceId, user, withoutNulls(dto));
  }

  @Get(':id/deliveries')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  @SchemaResponse(InvoiceDeliveryList)
  async deliveries(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoiceDeliveryService.history(id, workspaceId);
  }

  @Put(':id/void')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: true, isUndoable: false })
  @SchemaResponse(InvoiceWritten)
  async void(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoicesService.void(id, workspaceId, user.id);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.INVOICE_DELETE)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: true, isUndoable: true })
  @SchemaResponse(MessageResult)
  async remove(
    @SchemaParams(InvoiceParams) { id }: InvoiceParams,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.invoicesService.remove(id, workspaceId);
    return deletedResponse('Invoice');
  }
}
