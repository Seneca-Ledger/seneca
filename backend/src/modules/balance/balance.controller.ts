import { Controller, Delete, Get, HttpCode, Patch, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import {
  BalanceAccountParams,
  BalanceQuery,
  BalanceSheetResponse,
  CreateBalanceAccountBody,
  ExportBalanceQuery,
  UpdateAccountClassificationBody,
  UpdateBalanceSnapshotBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BalanceService } from './balance.service';

/**
 * Reading the balance sheet is a report; changing it changes what the workspace owns and owes, so the
 * writes take the wallet permissions, like crypto holdings (owner and admins).
 */
@Controller('reports/balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get('sheet')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(BalanceSheetResponse)
  async getSheet(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(BalanceQuery) query: BalanceQuery,
  ): Promise<unknown> {
    return this.balanceService.getBalanceSheet(
      workspaceId,
      query.date,
      query.locale || user.locale,
    );
  }

  @Get('accounts')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getAccounts(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(BalanceQuery) query: BalanceQuery,
  ): Promise<unknown> {
    return this.balanceService.getAccountsTree(
      workspaceId,
      query.date,
      query.locale || user.locale,
    );
  }

  @Put('snapshot')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  async updateSnapshot(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpdateBalanceSnapshotBody) dto: UpdateBalanceSnapshotBody,
  ) {
    return this.balanceService.updateSnapshot(user.id, workspaceId, dto);
  }

  @Post('accounts')
  @WorkspaceAuth(Permission.WALLET_CREATE)
  async createAccount(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateBalanceAccountBody) dto: CreateBalanceAccountBody,
  ) {
    return this.balanceService.createCustomAccount(user.id, workspaceId, dto);
  }

  @Delete('accounts/:id')
  @HttpCode(204)
  @WorkspaceAuth(Permission.WALLET_DELETE)
  async deleteAccount(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BalanceAccountParams) { id }: BalanceAccountParams,
  ): Promise<void> {
    await this.balanceService.deleteCustomAccount(user.id, workspaceId, id);
  }

  @Patch('accounts/:id/classification')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  async updateClassification(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BalanceAccountParams) { id }: BalanceAccountParams,
    @SchemaBody(UpdateAccountClassificationBody) dto: UpdateAccountClassificationBody,
  ) {
    return this.balanceService.updateAccountClassification(user.id, workspaceId, id, dto);
  }

  @Get('export')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async exportBalance(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(ExportBalanceQuery) dto: ExportBalanceQuery,
    @Res() res: Response,
  ) {
    const payload = await this.balanceService.exportBalanceSheet(
      workspaceId,
      dto,
      dto.locale || user.locale,
    );

    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', payload.fileName));
    res.send(payload.buffer);
  }
}
