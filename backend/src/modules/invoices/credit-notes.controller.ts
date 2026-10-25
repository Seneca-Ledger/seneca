import { Controller, Delete, Get, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import {
  CreateCreditNoteBody,
  CreditNoteParams,
  InvoicesQuery,
  XRechnungCheck,
} from '../../contracts';
import {
  CreditNoteDetail,
  CreditNoteListPage,
  CreditNoteWritten,
} from '../../contracts/invoices/invoice-writes';
import { EntityType } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreditNotesService } from './credit-notes.service';
import { InvoiceXRechnungService } from './invoice-xrechnung.service';

@Controller('credit-notes')
export class CreditNotesController {
  constructor(
    private readonly creditNotesService: CreditNotesService,
    private readonly xrechnungService: InvoiceXRechnungService,
  ) {}

  /** Raises and issues the note in one step: there is no draft to keep. */
  @Post()
  @WorkspaceAuth(Permission.INVOICE_CREATE)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: true, isUndoable: false })
  @SchemaResponse(CreditNoteWritten)
  async create(
    @SchemaBody(CreateCreditNoteBody) dto: CreateCreditNoteBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.creditNotesService.create(workspaceId, user.id, dto);
  }

  @Get()
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  @SchemaResponse(CreditNoteListPage)
  async findAll(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(InvoicesQuery) query: InvoicesQuery,
  ) {
    return this.creditNotesService.findAll(workspaceId, query);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  @SchemaResponse(CreditNoteDetail)
  async findOne(
    @SchemaParams(CreditNoteParams) { id }: CreditNoteParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.creditNotesService.findOne(id, workspaceId);
  }

  @Get(':id/pdf')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async downloadPdf(
    @SchemaParams(CreditNoteParams) { id }: CreditNoteParams,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { fileName, data } = await this.creditNotesService.getPdf(id, workspaceId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.send(data);
  }

  /** The credit note as an XRechnung (type 381) naming the invoice it corrects. */
  @Get(':id/xrechnung')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async downloadXRechnung(
    @SchemaParams(CreditNoteParams) { id }: CreditNoteParams,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { fileName, data } = await this.xrechnungService.creditNoteFile(id, workspaceId);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.send(data);
  }

  @Get(':id/xrechnung/check')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  @SchemaResponse(XRechnungCheck)
  async checkXRechnung(
    @SchemaParams(CreditNoteParams) { id }: CreditNoteParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.xrechnungService.checkCreditNote(id, workspaceId);
  }

  /** Voids it: the money goes back on the invoices and the entry is reversed. */
  @Delete(':id')
  @WorkspaceAuth(Permission.INVOICE_DELETE)
  @Audit({ entityType: EntityType.INVOICE, includeDiff: true, isUndoable: false })
  @SchemaResponse(CreditNoteWritten)
  async void(
    @SchemaParams(CreditNoteParams) { id }: CreditNoteParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.creditNotesService.void(id, workspaceId, user.id);
  }
}
