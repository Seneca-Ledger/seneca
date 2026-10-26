import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import {
  InvestmentParams,
  MetalLot,
  MetalReceiptList,
  MetalReceiptOptionsQuery,
  MetalSaleResult,
  MetalSettings,
  MetalSettingsBody,
  MetalsSummary,
  PriceRefreshResult,
  SellMetalLotBody,
  UpsertMetalLotBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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

/**
 * Reading the metals book is a report; changing it changes what the workspace owns, so the
 * writes take the wallet permissions, like crypto holdings (owner and admins).
 */
@Controller('metals')
export class MetalsController {
  constructor(private readonly metalsService: MetalsService) {}

  @Get()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(MetalsSummary)
  async summary(@WorkspaceId() workspaceId: string) {
    return this.metalsService.getSummary(workspaceId);
  }

  @Post('lots')
  @WorkspaceAuth(Permission.WALLET_CREATE)
  @SchemaResponse(MetalLot)
  async addLot(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpsertMetalLotBody) dto: UpsertMetalLotBody,
  ) {
    return this.metalsService.addLot(user.id, workspaceId, dto);
  }

  @Patch('lots/:id')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(MetalLot)
  async updateLot(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
    @SchemaBody(UpsertMetalLotBody) dto: UpsertMetalLotBody,
  ) {
    return this.metalsService.updateLot(user.id, workspaceId, id, dto);
  }

  @Delete('lots/:id')
  @HttpCode(204)
  @WorkspaceAuth(Permission.WALLET_DELETE)
  async deleteLot(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
  ) {
    await this.metalsService.deleteLot(user.id, workspaceId, id);
  }

  /** Receipts the workspace could attach to a lot, newest first. */
  @Get('receipt-options')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(MetalReceiptList)
  async receiptOptions(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(MetalReceiptOptionsQuery) query: MetalReceiptOptionsQuery,
  ) {
    return this.metalsService.listReceiptOptions(workspaceId, query.limit ?? 50);
  }

  /** Sells a lot, whole or in part; proceeds of zero record a gift. */
  @Post('lots/:id/sell')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(MetalSaleResult)
  async sellLot(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
    @SchemaBody(SellMetalLotBody) dto: SellMetalLotBody,
  ) {
    return this.metalsService.sellLot(user.id, workspaceId, id, dto);
  }

  /** What a dealer pays below spot, per metal. */
  @Patch('settings')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(MetalSettings)
  async saveSettings(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(MetalSettingsBody) dto: MetalSettingsBody,
  ) {
    const dealerDiscount = await this.metalsService.saveSettings(user.id, workspaceId, dto);
    return { dealerDiscount };
  }

  @Post('lots/:id/photo')
  @WorkspaceAuth(Permission.WALLET_EDIT)
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
  @SchemaResponse(MetalLot)
  async uploadPhoto(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
    @UploadedFile() file: UploadedPhoto | undefined,
  ) {
    if (!file) throw new BadRequestException(appError('METALS_PHOTO_NOT_UPLOADED'));
    return this.metalsService.setPhoto(workspaceId, id, file.filename);
  }

  @Delete('lots/:id/photo')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(MetalLot)
  async removePhoto(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
  ) {
    return this.metalsService.removePhoto(workspaceId, id);
  }

  /** Re-quotes every lot whose price was not hand-entered. */
  @Post('refresh-prices')
  @HttpCode(200)
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(PriceRefreshResult)
  async refreshPrices(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    const updated = await this.metalsService.refreshPrices(user.id, workspaceId);
    return { updated };
  }
}
