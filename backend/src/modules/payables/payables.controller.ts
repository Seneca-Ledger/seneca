import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  AddPayablePaymentBody,
  AllocateTransactionBody,
  AllocationSuggestion,
  CreatePayableBody,
  FilterPayablesBody,
  MarkPayablePaidBody,
  Payable,
  PayableList,
  PayableListPage,
  PayablePaymentList,
  PayablesQuery,
  PayablesSummary,
  PaymentCandidateList,
  UpdatePayableBody,
} from '../../contracts';
import { EntityType } from '../../entities/audit-event.entity';
import { PayableDirection } from '../../entities/payable.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PayablesService } from './payables.service';

@Controller('payables')
export class PayablesController {
  constructor(private readonly payablesService: PayablesService) {}

  @Post()
  @WorkspaceAuth(Permission.PAYABLE_CREATE)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async create(
    @SchemaBody(CreatePayableBody) createDto: CreatePayableBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.create(workspaceId, user.id, createDto);
  }

  @Get()
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(PayableListPage)
  async findAll(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(PayablesQuery) query: PayablesQuery,
  ) {
    return this.payablesService.findAll(workspaceId, query);
  }

  @Get('summary')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(PayablesSummary)
  async getSummary(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(PayablesQuery) query: PayablesQuery,
  ) {
    return this.payablesService.getSummary(workspaceId, toEnum(PayableDirection, query.direction));
  }

  @Get(':id')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(Payable)
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @WorkspaceId() workspaceId: string) {
    return this.payablesService.findOne(id, workspaceId);
  }

  @Get(':id/payment-candidates')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(PaymentCandidateList)
  async findPaymentCandidates(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.findPaymentCandidates(id, workspaceId);
  }

  @Get(':id/payments')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(PayablePaymentList)
  async listPayments(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.listPayments(id, workspaceId);
  }

  @Post(':id/payments')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async addPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @SchemaBody(AddPayablePaymentBody) dto: AddPayablePaymentBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.addPayment(id, workspaceId, user.id, dto);
  }

  @Delete(':id/payments/:paymentId')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async removePayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.removePayment(id, paymentId, workspaceId);
  }

  /** Which bills one transaction probably covers; writes nothing. */
  @Get('allocation-suggestion/:transactionId')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(AllocationSuggestion)
  async suggestAllocation(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.suggestAllocation(workspaceId, transactionId);
  }

  /** One transaction spread over several bills. */
  @Post('allocate')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: false, isUndoable: false })
  @SchemaResponse(PayableList)
  async allocate(
    @SchemaBody(AllocateTransactionBody) dto: AllocateTransactionBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.allocateTransaction(workspaceId, user.id, dto);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @SchemaBody(UpdatePayableBody) updateDto: UpdatePayableBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.update(id, workspaceId, user.id, updateDto);
  }

  @Put(':id/mark-paid')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async markAsPaid(
    @Param('id', new ParseUUIDPipe()) id: string,
    @SchemaBody(MarkPayablePaidBody) body: MarkPayablePaidBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.markAsPaid(id, workspaceId, user.id, body);
  }

  @Put(':id/archive')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async archive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.archive(id, workspaceId, user.id);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.PAYABLE_DELETE)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.payablesService.remove(id, workspaceId, user.id);
    return deletedResponse('Payable');
  }

  @Post('export')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  async export(
    @SchemaBody(FilterPayablesBody) body: FilterPayablesBody,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { filePath, fileName, contentType } = await this.payablesService.exportData(
      workspaceId,
      body,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    const fileStream = fs.createReadStream(filePath);
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore cleanup failures
      }
    };
    fileStream.pipe(res);
    fileStream.on('end', cleanup);
    fileStream.on('error', cleanup);
    res.on('close', cleanup);
  }
}
