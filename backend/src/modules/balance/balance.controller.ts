import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import {
  BalanceAccountClassification,
  BalanceAccountCreated,
  BalanceAccountHistory,
  BalanceAccountParams,
  BalanceAccountsTree,
  BalanceHistoryImported,
  BalanceHistoryPointDeleted,
  BalanceHistoryPointParams,
  BalancePersonalLayoutApplied,
  BalanceQuery,
  BalanceSheetResponse,
  BalanceSnapshotSaved,
  CreateBalanceAccountBody,
  ExportBalanceQuery,
  UpdateAccountClassificationBody,
  UpdateBalanceSnapshotBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BalanceService } from './balance.service';
import { BalanceHistoryService } from './balance-history.service';
import { readBalanceHistoryFile } from './balance-history-file';
import { BalancePersonalLayoutService } from './balance-personal-layout.service';

type MulterFile = Express.Multer.File;

/** A balance history is a column of dates and amounts; two megabytes is years of it. */
const MAX_HISTORY_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Reading the balance sheet is a report; changing it changes what the workspace owns and owes, so the
 * writes take the wallet permissions, like crypto holdings (owner and admins).
 */
@Controller('reports/balance')
export class BalanceController {
  constructor(
    private readonly balanceService: BalanceService,
    private readonly historyService: BalanceHistoryService,
    private readonly personalLayoutService: BalancePersonalLayoutService,
  ) {}

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
  @SchemaResponse(BalanceAccountsTree)
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
  @SchemaResponse(BalanceSnapshotSaved)
  async updateSnapshot(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpdateBalanceSnapshotBody) dto: UpdateBalanceSnapshotBody,
  ) {
    return this.balanceService.updateSnapshot(user.id, workspaceId, dto);
  }

  @Post('personal-layout')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(BalancePersonalLayoutApplied)
  async applyPersonalLayout(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.personalLayoutService.applyPersonalLayout(user.id, workspaceId);
  }

  @Get('accounts/:id/history')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(BalanceAccountHistory)
  async getAccountHistory(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BalanceAccountParams) { id }: BalanceAccountParams,
  ) {
    return this.historyService.getAccountHistory(workspaceId, id);
  }

  @Delete('accounts/:id/history/:date')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(BalanceHistoryPointDeleted)
  async deleteAccountHistoryPoint(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BalanceHistoryPointParams) { id, date }: BalanceHistoryPointParams,
  ) {
    return this.historyService.deleteSnapshot(user.id, workspaceId, id, date);
  }

  @Post('accounts/:id/history')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(BalanceHistoryImported)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_HISTORY_FILE_BYTES } }))
  async importAccountHistory(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BalanceAccountParams) { id }: BalanceAccountParams,
    @UploadedFile() file: MulterFile | undefined,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException(appError('FILE_NOT_PROVIDED'));
    }
    const rows = readBalanceHistoryFile(file.buffer);
    return this.historyService.importAccountHistory(user.id, workspaceId, id, rows);
  }

  @Post('accounts')
  @WorkspaceAuth(Permission.WALLET_CREATE)
  @SchemaResponse(BalanceAccountCreated)
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
  @SchemaResponse(BalanceAccountClassification)
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
