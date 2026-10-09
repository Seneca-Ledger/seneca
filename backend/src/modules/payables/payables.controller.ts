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
import * as fs from 'fs';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { deletedResponse } from '../../common/utils/responses.util';
import { EntityType } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AddPayablePaymentDto, AllocateTransactionDto } from './dto/add-payable-payment.dto';
import { CreatePayableDto } from './dto/create-payable.dto';
import { FilterPayablesDto } from './dto/filter-payables.dto';
import { MarkPayablePaidDto } from './dto/mark-payable-paid.dto';
import { UpdatePayableDto } from './dto/update-payable.dto';
import { PayablesService } from './payables.service';

@Controller('payables')
export class PayablesController {
  constructor(private readonly payablesService: PayablesService) {}

  @Post()
  @WorkspaceAuth(Permission.PAYABLE_CREATE)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  async create(
    @Body() createDto: CreatePayableDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.create(workspaceId, user.id, createDto);
  }

  @Get()
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  async findAll(@WorkspaceId() workspaceId: string, @Query() query: FilterPayablesDto) {
    return this.payablesService.findAll(workspaceId, query);
  }

  @Get('summary')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  async getSummary(@WorkspaceId() workspaceId: string, @Query() query: FilterPayablesDto) {
    return this.payablesService.getSummary(workspaceId, query.direction);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @WorkspaceId() workspaceId: string) {
    return this.payablesService.findOne(id, workspaceId);
  }

  @Get(':id/payment-candidates')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  async findPaymentCandidates(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.findPaymentCandidates(id, workspaceId);
  }

  @Get(':id/payments')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  async listPayments(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.listPayments(id, workspaceId);
  }

  @Post(':id/payments')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  async addPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddPayablePaymentDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.addPayment(id, workspaceId, user.id, dto);
  }

  @Delete(':id/payments/:paymentId')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
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
  async allocate(
    @Body() dto: AllocateTransactionDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.allocateTransaction(workspaceId, user.id, dto);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateDto: UpdatePayableDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.update(id, workspaceId, user.id, updateDto);
  }

  @Put(':id/mark-paid')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  async markAsPaid(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: MarkPayablePaidDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.markAsPaid(id, workspaceId, user.id, body);
  }

  @Put(':id/archive')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
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
    @Body() body: FilterPayablesDto,
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
