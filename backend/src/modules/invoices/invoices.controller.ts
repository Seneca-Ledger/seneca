import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { deletedResponse } from '../../common/utils/responses.util';
import { EntityType } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreditNotesService } from './credit-notes.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';
import { SendInvoiceEmailDto } from './dto/send-invoice-email.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdateInvoiceSettingsDto } from './dto/update-invoice-settings.dto';
import { InvoiceAgeingService } from './invoice-ageing.service';
import { InvoiceDeliveryService } from './invoice-delivery.service';
import { InvoiceSettingsService } from './invoice-settings.service';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoiceDeliveryService: InvoiceDeliveryService,
    private readonly invoiceSettingsService: InvoiceSettingsService,
    private readonly invoiceAgeingService: InvoiceAgeingService,
    private readonly creditNotesService: CreditNotesService,
  ) {}

  @Post()
  @WorkspaceAuth(Permission.INVOICE_CREATE)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: true, isUndoable: true })
  async create(@Body() dto: CreateInvoiceDto, @WorkspaceId() workspaceId: string) {
    return this.invoicesService.create(workspaceId, dto);
  }

  @Get()
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async findAll(@WorkspaceId() workspaceId: string, @Query() query: FilterInvoicesDto) {
    return this.invoicesService.findAll(workspaceId, query);
  }

  @Get('settings')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async getSettings(@WorkspaceId() workspaceId: string) {
    const [numbering, settings] = await Promise.all([
      this.invoicesService.getNumberingSettings(workspaceId),
      this.invoiceSettingsService.get(workspaceId),
    ]);
    return { ...numbering, ...settings };
  }

  @Put('settings')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  async updateSettings(@Body() dto: UpdateInvoiceSettingsDto, @WorkspaceId() workspaceId: string) {
    const numbering =
      dto.prefix === undefined
        ? await this.invoicesService.getNumberingSettings(workspaceId)
        : await this.invoicesService.updateNumberPrefix(workspaceId, dto.prefix);
    const settings = await this.invoiceSettingsService.update(workspaceId, dto);
    return { ...numbering, ...settings };
  }

  @Get('ageing')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async ageing(@WorkspaceId() workspaceId: string) {
    return this.invoiceAgeingService.report(workspaceId);
  }

  /** What a late fee would come to for this client, at the workspace's percent. */
  @Get('clients/:clientId/late-fee')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async lateFee(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
    @WorkspaceId() workspaceId: string,
  ) {
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
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @WorkspaceId() workspaceId: string) {
    return this.invoicesService.findOne(id, workspaceId);
  }

  /** The credit notes raised against this invoice. */
  @Get(':id/credit-notes')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async creditNotes(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.creditNotesService.findForInvoice(id, workspaceId);
  }

  @Get(':id/pdf')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async downloadPdf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { fileName, data } = await this.invoicesService.getPdf(id, workspaceId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.send(data);
  }

  @Get(':id/preview')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async previewPdf(
    @Param('id', new ParseUUIDPipe()) id: string,
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
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInvoiceDto,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoicesService.update(id, workspaceId, dto);
  }

  @Put(':id/send')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: true, isUndoable: false })
  async send(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoicesService.send(id, workspaceId, user.id);
  }

  @Post(':id/deliveries')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: false, isUndoable: false })
  async emailInvoice(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendInvoiceEmailDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoiceDeliveryService.sendEmail(id, workspaceId, user, dto);
  }

  @Get(':id/deliveries')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async deliveries(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoiceDeliveryService.history(id, workspaceId);
  }

  @Put(':id/void')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: true, isUndoable: false })
  async void(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.invoicesService.void(id, workspaceId, user.id);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.INVOICE_DELETE)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: true, isUndoable: true })
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @WorkspaceId() workspaceId: string) {
    await this.invoicesService.remove(id, workspaceId);
    return deletedResponse('Invoice');
  }
}
