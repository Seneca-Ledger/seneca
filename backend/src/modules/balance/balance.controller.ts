import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BalanceService } from './balance.service';
import { readBalanceHistoryFile } from './balance-history-file';
import { BalanceQueryDto } from './dto/balance-query.dto';
import { CreateBalanceAccountDto } from './dto/create-balance-account.dto';
import { ExportBalanceDto } from './dto/export-balance.dto';
import { UpdateAccountClassificationDto } from './dto/update-account-classification.dto';
import { UpdateBalanceSnapshotDto } from './dto/update-balance-snapshot.dto';

type MulterFile = Express.Multer.File;

/** A balance history is a column of dates and amounts; two megabytes is years of it. */
const MAX_HISTORY_FILE_BYTES = 2 * 1024 * 1024;

@Controller('reports/balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get('sheet')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getSheet(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query() query: BalanceQueryDto,
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
    @Query() query: BalanceQueryDto,
  ): Promise<unknown> {
    return this.balanceService.getAccountsTree(
      workspaceId,
      query.date,
      query.locale || user.locale,
    );
  }

  @Put('snapshot')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async updateSnapshot(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateBalanceSnapshotDto,
  ) {
    return this.balanceService.updateSnapshot(user.id, workspaceId, dto);
  }

  @Get('accounts/:id/history')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getAccountHistory(
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.balanceService.getAccountHistory(workspaceId, id);
  }

  @Delete('accounts/:id/history/:date')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async deleteAccountHistoryPoint(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('date') date: string,
  ) {
    return this.balanceService.deleteSnapshot(user.id, workspaceId, id, date);
  }

  @Post('accounts/:id/history')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_HISTORY_FILE_BYTES } }))
  async importAccountHistory(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: MulterFile | undefined,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('No file provided');
    }
    const rows = readBalanceHistoryFile(file.buffer);
    return this.balanceService.importAccountHistory(user.id, workspaceId, id, rows);
  }

  @Post('accounts')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async createAccount(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateBalanceAccountDto,
  ) {
    return this.balanceService.createCustomAccount(user.id, workspaceId, dto);
  }

  @Delete('accounts/:id')
  @HttpCode(204)
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async deleteAccount(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.balanceService.deleteCustomAccount(user.id, workspaceId, id);
  }

  @Patch('accounts/:id/classification')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async updateClassification(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountClassificationDto,
  ) {
    return this.balanceService.updateAccountClassification(user.id, workspaceId, id, dto);
  }

  @Get('export')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async exportBalance(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query() dto: ExportBalanceDto,
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
