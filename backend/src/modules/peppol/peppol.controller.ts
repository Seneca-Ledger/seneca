import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { PeppolLookupBody, SavePeppolSettingsBody } from '../../contracts';
import { EntityType } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PeppolService } from './peppol.service';

/**
 * The access point account lives with the other integrations (the generic
 * protocol page reads status/settings/sync/disconnect); sending and the
 * delivery log live with the documents.
 */
@Controller()
export class PeppolController {
  constructor(private readonly peppol: PeppolService) {}

  /** Read by every invoice page: it decides whether the Peppol panel shows. */
  @Get('integrations/peppol/status')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  status(@WorkspaceId() workspaceId: string) {
    return this.peppol.status(workspaceId);
  }

  @Post('integrations/peppol/settings')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  connect(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SavePeppolSettingsBody) body: SavePeppolSettingsBody,
  ) {
    return this.peppol.connect(workspaceId, body);
  }

  /** Takes in what arrived since the last poll. */
  @Post('integrations/peppol/sync')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  sync(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.peppol.poll(workspaceId, user.id);
  }

  @Delete('integrations/peppol')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  disconnect(@WorkspaceId() workspaceId: string) {
    return this.peppol.disconnect(workspaceId);
  }

  /** Calls the access point with the workspace's credentials: for those who send invoices. */
  @Post('peppol/lookup')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  lookup(@WorkspaceId() workspaceId: string, @SchemaBody(PeppolLookupBody) body: PeppolLookupBody) {
    return this.peppol.lookup(workspaceId, body.peppolId);
  }

  @Post('invoices/:id/peppol')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  @Audit({ entityType: EntityType.INVOICE, isUndoable: false })
  sendInvoice(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.peppol.send(workspaceId, user.id, 'invoice', id);
  }

  @Get('invoices/:id/peppol')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  invoiceTransmissions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.peppol.transmissionsFor(workspaceId, 'invoice', id);
  }

  @Post('credit-notes/:id/peppol')
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  @Audit({ entityType: EntityType.INVOICE, isUndoable: false })
  sendCreditNote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.peppol.send(workspaceId, user.id, 'credit_note', id);
  }

  @Get('credit-notes/:id/peppol')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  creditNoteTransmissions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.peppol.transmissionsFor(workspaceId, 'credit_note', id);
  }

  /** The XML exactly as it went over Peppol. */
  @Get('peppol/transmissions/:id/document')
  @WorkspaceAuth(Permission.INVOICE_VIEW)
  async sentDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { fileName, data } = await this.peppol.sentDocument(workspaceId, id);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.send(data);
  }
}
