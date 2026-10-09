import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MetalSettingsDto } from './dto/metal-settings.dto';
import { SellMetalLotDto } from './dto/sell-metal-lot.dto';
import { UpsertMetalLotDto } from './dto/upsert-metal-lot.dto';
import { MetalsService, PHOTO_DIRECTORY } from './metals.service';

/**
 * Rasters only, never SVG: the photo is served back from our own origin,
 * where an SVG's embedded script would run as first-party code.
 */
const PHOTO_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

interface UploadedPhoto {
  filename: string;
}

@Controller('metals')
export class MetalsController {
  constructor(private readonly metalsService: MetalsService) {}

  @Get()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async summary(@WorkspaceId() workspaceId: string) {
    return this.metalsService.getSummary(workspaceId);
  }

  @Post('lots')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async addLot(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpsertMetalLotDto,
  ) {
    return this.metalsService.addLot(user.id, workspaceId, dto);
  }

  @Patch('lots/:id')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async updateLot(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpsertMetalLotDto,
  ) {
    return this.metalsService.updateLot(user.id, workspaceId, id, dto);
  }

  @Delete('lots/:id')
  @HttpCode(204)
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async deleteLot(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.metalsService.deleteLot(user.id, workspaceId, id);
  }

  /** Receipts the workspace could attach to a lot, newest first. */
  @Get('receipt-options')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async receiptOptions(@WorkspaceId() workspaceId: string, @Query('limit') limit?: string) {
    return this.metalsService.listReceiptOptions(workspaceId, Number(limit) || 50);
  }

  /** Sells a lot, whole or in part; proceeds of zero record a gift. */
  @Post('lots/:id/sell')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async sellLot(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: SellMetalLotDto,
  ) {
    return this.metalsService.sellLot(user.id, workspaceId, id, dto);
  }

  /** What a dealer pays below spot, per metal. */
  @Patch('settings')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async saveSettings(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: MetalSettingsDto,
  ) {
    const dealerDiscount = await this.metalsService.saveSettings(user.id, workspaceId, dto);
    return { dealerDiscount };
  }

  @Post('lots/:id/photo')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const target = path.join(resolveUploadsDir(), PHOTO_DIRECTORY);
          if (!existsSync(target)) {
            mkdirSync(target, { recursive: true });
          }
          cb(null, target);
        },
        // A fresh uuid for a name: the file is served without a session, so the
        // link must be unguessable and the extension not the uploader's choice.
        filename: (_req, file, cb) => {
          const extension = PHOTO_EXTENSION_BY_MIME[file.mimetype];
          if (!extension) {
            return cb(new BadRequestException('Unsupported photo type'), '');
          }
          cb(null, `${randomUUID()}${extension}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!PHOTO_EXTENSION_BY_MIME[file.mimetype]) {
          return cb(new BadRequestException('Only JPEG, PNG and WebP photos are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: PHOTO_MAX_BYTES },
    }),
  )
  async uploadPhoto(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @UploadedFile() file: UploadedPhoto | undefined,
  ) {
    if (!file) throw new BadRequestException('No photo uploaded');
    return this.metalsService.setPhoto(workspaceId, id, file.filename);
  }

  @Delete('lots/:id/photo')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async removePhoto(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    return this.metalsService.removePhoto(workspaceId, id);
  }

  /** Re-quotes every lot whose price was not hand-entered. */
  @Post('refresh-prices')
  @HttpCode(200)
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async refreshPrices(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    const updated = await this.metalsService.refreshPrices(user.id, workspaceId);
    return { updated };
  }
}
