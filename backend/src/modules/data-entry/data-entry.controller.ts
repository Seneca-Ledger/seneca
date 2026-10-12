import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Headers,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { appError } from '../../common/errors/app-error';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { IdempotencyService } from '../../common/services/idempotency.service';
import {
  isAllowedCustomIconMime,
  sanitizePublicUploadFilename,
} from '../../common/utils/public-upload.util';
import {
  CreateDataEntryBody,
  CreateDataEntryCustomFieldBody,
  UpdateDataEntryCustomFieldBody,
} from '../../contracts';
import { DataEntryType } from '../../entities/data-entry.entity';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DataEntryService } from './data-entry.service';

@Controller('data-entry')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class DataEntryController {
  constructor(
    private readonly dataEntryService: DataEntryService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateDataEntryBody) dto: CreateDataEntryBody,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const cached = await this.idempotencyService.checkKey(idempotencyKey, user.id, workspaceId);
      if (cached) {
        return cached.data;
      }
    }

    const entry = await this.dataEntryService.create(workspaceId, user.id, dto);

    if (idempotencyKey) {
      await this.idempotencyService.storeKey(idempotencyKey, user.id, workspaceId, entry);
    }

    return entry;
  }

  @Get()
  async list(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Query('type') type?: DataEntryType,
    @Query('customTabId') customTabId?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('q') query?: string,
    @Query('date') date?: string,
  ) {
    const safeLimit = Math.min(Math.max(limit || 50, 1), 200);
    const safePage = Math.max(page || 1, 1);
    const { items, total } = await this.dataEntryService.list({
      workspaceId,
      type,
      customTabId,
      limit: safeLimit,
      page: safePage,
      query,
      date,
    });
    return { items, total, page: safePage, limit: safeLimit };
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.dataEntryService.remove(workspaceId, user.id, id);
    return { ok: true };
  }

  @Get('custom-fields')
  async listCustomFields(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    const [items, hiddenBaseTabs] = await Promise.all([
      this.dataEntryService.listCustomFields(workspaceId),
      this.dataEntryService.getHiddenBaseTabs(user.id),
    ]);
    return { items, hiddenBaseTabs };
  }

  @Delete('base-tabs/:type')
  async removeBaseTab(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('type', new ParseEnumPipe(DataEntryType)) type: DataEntryType,
  ) {
    await this.dataEntryService.removeBaseTab(workspaceId, user.id, type);
    return { ok: true };
  }

  @Post('custom-fields')
  async createCustomField(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateDataEntryCustomFieldBody) dto: CreateDataEntryCustomFieldBody,
  ) {
    return this.dataEntryService.createCustomField(workspaceId, user.id, dto);
  }

  @Post('custom-fields/icon')
  @UseInterceptors(
    FileInterceptor('icon', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
          const targetDir = path.join(uploadsDir, 'custom-field-icons');
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          cb(null, targetDir);
        },
        filename: (_req, file, cb) => {
          try {
            cb(null, sanitizePublicUploadFilename(file));
          } catch (error) {
            cb(error as Error, '');
          }
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!isAllowedCustomIconMime(file.mimetype)) {
          return cb(new Error('Only PNG, JPEG, WEBP, or GIF images allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 1_500_000 },
    }),
  )
  async uploadCustomIcon(@UploadedFile() file: { filename: string } | undefined) {
    if (!file) {
      throw new BadRequestException(appError('FILE_NOT_UPLOADED'));
    }
    const url = `/uploads/custom-field-icons/${file.filename}`;
    return { url };
  }

  @Patch('custom-fields/:id')
  async updateCustomField(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @SchemaBody(UpdateDataEntryCustomFieldBody) dto: UpdateDataEntryCustomFieldBody,
  ) {
    return this.dataEntryService.updateCustomField(workspaceId, user.id, id, dto);
  }

  @Delete('custom-fields/:id')
  async removeCustomField(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.dataEntryService.removeCustomField(workspaceId, user.id, id);
    return { ok: true };
  }
}
