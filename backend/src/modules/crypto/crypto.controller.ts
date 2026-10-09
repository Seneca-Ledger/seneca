import { readFile, unlink } from 'node:fs/promises';
import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { multerConfig } from '../../config/multer.config';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CryptoService } from './crypto.service';
import { CryptoIconsService } from './crypto-icons.service';
import { CryptoImportService } from './crypto-import.service';
import { ConnectCryptoWalletDto } from './dto/connect-crypto-wallet.dto';
import { ManualHoldingDto } from './dto/manual-holding.dto';

@Controller('crypto')
export class CryptoController {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly importService: CryptoImportService,
    private readonly iconsService: CryptoIconsService,
  ) {}

  /**
   * The coin's own logo. No workspace scope: a logo carries no tenant data, and
   * the global auth guard still requires a signed-in user, so this is not an open
   * proxy. A holdings table renders one image per row, which the API rate limit
   * is not sized for.
   */
  @Get('icon/:asset')
  @SkipThrottle()
  async getIcon(@Param('asset') asset: string, @Res() res: Response) {
    const icon = await this.iconsService.fetchIcon(asset);
    if (icon.status === 'invalid') {
      throw new BadRequestException('Not a ticker');
    }
    // 404 rather than a placeholder: it fires the <img> error handler, which is
    // how the page falls back to the monogram.
    if (icon.status === 'missing') {
      throw new NotFoundException('No icon for this asset');
    }
    if (icon.status === 'unavailable') {
      throw new BadGatewayException('Coin icons are unavailable');
    }

    res.setHeader('Content-Type', icon.contentType);
    // private: the response sits behind the session cookie.
    res.setHeader('Cache-Control', 'private, max-age=2592000');
    return res.send(icon.body);
  }

  @Get('wallets')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  async findAll(@WorkspaceId() workspaceId: string) {
    return this.cryptoService.findAll(workspaceId);
  }

  @Get('networks')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  getNetworks() {
    return this.cryptoService.getNetworks();
  }

  @Get('summary')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  async getSummary(
    @WorkspaceId() workspaceId: string,
    @Query('days') days?: string,
    @Query('month') month?: string,
  ) {
    const parsed = Number.parseInt(days ?? '', 10);
    return this.cryptoService.getSummary(
      workspaceId,
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 365) : 30,
      // Anything but a real YYYY-MM falls back to the rolling window.
      month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined,
    );
  }

  @Get('transactions')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  async getRecentTransactions(@WorkspaceId() workspaceId: string, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '', 10);
    return this.cryptoService.getRecentTransactions(
      workspaceId,
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20,
    );
  }

  @Get('history')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  async getHistory(@WorkspaceId() workspaceId: string, @Query('days') days?: string) {
    const parsed = Number.parseInt(days ?? '', 10);
    return this.cryptoService.getHistory(
      workspaceId,
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1825) : 90,
    );
  }

  /**
   * What was sold in a year and what it had cost — the rows a capital gains
   * return is built from. Without a year, the whole history.
   */
  @Get('gains')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  async getGains(@WorkspaceId() workspaceId: string, @Query('year') year?: string) {
    const parsed = Number.parseInt(year ?? '', 10);
    const valid = Number.isFinite(parsed) && parsed >= 2009 && parsed <= 2100;
    return this.cryptoService.getGains(
      workspaceId,
      valid ? { from: `${parsed}-01-01`, to: `${parsed}-12-31` } : {},
    );
  }

  /**
   * The same sales, split by whose wallet they happened in. A tax allowance
   * belongs to a person, so two members' sales are never added into one.
   */
  @Get('gains/by-owner')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  async getGainsByOwner(@WorkspaceId() workspaceId: string, @Query('year') year?: string) {
    const parsed = Number.parseInt(year ?? '', 10);
    const valid = Number.isFinite(parsed) && parsed >= 2009 && parsed <= 2100;
    return this.cryptoService.getGainsByOwner(
      workspaceId,
      valid ? { from: `${parsed}-01-01`, to: `${parsed}-12-31` } : {},
    );
  }

  @Post('holdings')
  @WorkspaceAuth(Permission.WALLET_CREATE)
  async upsertHolding(
    @Body() dto: ManualHoldingDto,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.cryptoService.upsertManualHolding(workspaceId, user.id, dto);
  }

  @Delete('holdings/:asset')
  @WorkspaceAuth(Permission.WALLET_DELETE)
  async removeHolding(
    @Param('asset') asset: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.cryptoService.removeManualHolding(workspaceId, user.id, asset);
    return { success: true };
  }

  /**
   * A history export from Coinbase, Binance or Kraken. The file is read and
   * deleted; only the movements it describes are kept.
   */
  @Post('import')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @WorkspaceAuth(Permission.WALLET_CREATE)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async importExchangeCsv(
    // `unknown`, not `Express.Multer.File`: the decorator's emitted metadata would
    // reference a namespace that exists only in the type system.
    @UploadedFile() file: unknown,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    const path = uploadedPath(file);
    if (!path) {
      throw new BadRequestException('No file provided');
    }
    try {
      const csv = await readFile(path, 'utf-8');
      return await this.importService.importCsv(workspaceId, user.id, csv);
    } finally {
      await unlink(path).catch(() => undefined);
    }
  }

  @Post('wallets')
  @WorkspaceAuth(Permission.WALLET_CREATE)
  async connect(
    @Body() dto: ConnectCryptoWalletDto,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.cryptoService.connect(workspaceId, user.id, dto);
  }

  // Each sync fans out to a rate-limited block explorer and a price API, so the
  // manual refresh button gets a tighter budget than an ordinary endpoint.
  @Post('wallets/:id/sync')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  @WorkspaceAuth(Permission.WALLET_EDIT)
  async sync(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.cryptoService.sync(workspaceId, id, user.id);
  }

  @Delete('wallets/:id')
  @WorkspaceAuth(Permission.WALLET_DELETE)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.cryptoService.remove(workspaceId, id, user.id);
    return { success: true };
  }
}

/** Where multer put the upload, when it put one anywhere. */
function uploadedPath(file: unknown): string | null {
  const path = (file as { path?: unknown } | null)?.path;
  return typeof path === 'string' && path.length > 0 ? path : null;
}
