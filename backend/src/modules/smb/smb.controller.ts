import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { ConfirmReconciliationBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SmbService } from './smb.service';

@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly smbService: SmbService) {}

  /** Open bills and receivables with the bank rows that look like their payment, ageing and duplicates. */
  @Get()
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  async get(@WorkspaceId() workspaceId: string) {
    return this.smbService.getReconciliation(workspaceId);
  }

  @Get('ageing')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  async ageing(@WorkspaceId() workspaceId: string) {
    return this.smbService.getAgeing(workspaceId);
  }

  @Get('duplicates')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  async duplicates(@WorkspaceId() workspaceId: string) {
    return this.smbService.getDuplicates(workspaceId);
  }

  /** Links the row to the bill and marks it paid. */
  @Post('confirm')
  @HttpCode(200)
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  async confirm(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
    @SchemaBody(ConfirmReconciliationBody) dto: ConfirmReconciliationBody,
  ) {
    return this.smbService.confirm(workspaceId, user.id, dto.payableId, dto.transactionId);
  }
}

@Controller('invoices')
export class InvoiceRemindersController {
  constructor(private readonly smbService: SmbService) {}

  /** Emails the client a reminder about a sent or overdue invoice. */
  @Post(':id/remind')
  @HttpCode(200)
  @WorkspaceAuth(Permission.INVOICE_EDIT)
  async remind(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.smbService.sendInvoiceReminder(workspaceId, user, id);
  }
}
