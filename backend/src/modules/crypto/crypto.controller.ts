import { readFile, unlink } from 'node:fs/promises';
import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { resolveInUploadsDir } from '../../common/utils/uploads.util';
import { multerConfig } from '../../config/multer.config';
import {
  ConnectCryptoWalletBody,
  CryptoGains,
  CryptoGainsByOwner,
  CryptoGainsQuery,
  CryptoHistory,
  CryptoHistoryQuery,
  CryptoHoldingParams,
  CryptoIconParams,
  CryptoNetworkList,
  CryptoRemoved,
  CryptoSummary,
  CryptoSummaryQuery,
  CryptoSyncResult,
  CryptoTransactionList,
  CryptoTransactionsQuery,
  CryptoWallet,
  CryptoWalletList,
  CryptoWalletParams,
  ExchangeImportResult,
  ManualHoldingBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CryptoService } from './crypto.service';
import { CryptoIconsService } from './crypto-icons.service';
import { CryptoImportService } from './crypto-import.service';

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
  async getIcon(@SchemaParams(CryptoIconParams) { asset }: CryptoIconParams, @Res() res: Response) {
    const icon = await this.iconsService.fetchIcon(asset);
    if (icon.status === 'invalid') {
      throw new BadRequestException(appError('CRYPTO_TICKER_INVALID'));
    }
    // 404 rather than a placeholder: it fires the <img> error handler, which is
    // how the page falls back to the monogram.
    if (icon.status === 'missing') {
      throw new NotFoundException(appError('CRYPTO_ICON_NOT_FOUND'));
    }
    if (icon.status === 'unavailable') {
      throw new BadGatewayException(appError('CRYPTO_ICONS_UNAVAILABLE'));
    }

    res.setHeader('Content-Type', icon.contentType);
    // private: the response sits behind the session cookie.
    res.setHeader('Cache-Control', 'private, max-age=2592000');
    return res.send(icon.body);
  }

  @Get('wallets')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(CryptoWalletList)
  async findAll(@WorkspaceId() workspaceId: string) {
    return this.cryptoService.findAll(workspaceId);
  }

  @Get('networks')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(CryptoNetworkList)
  getNetworks() {
    return this.cryptoService.getNetworks();
  }

  @Get('summary')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(CryptoSummary)
  async getSummary(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(CryptoSummaryQuery) query: CryptoSummaryQuery,
  ) {
    return this.cryptoService.getSummary(workspaceId, Math.min(query.days ?? 30, 365), query.month);
  }

  @Get('transactions')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(CryptoTransactionList)
  async getRecentTransactions(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(CryptoTransactionsQuery) query: CryptoTransactionsQuery,
  ) {
    return this.cryptoService.getRecentTransactions(workspaceId, Math.min(query.limit ?? 20, 100));
  }

  @Get('history')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(CryptoHistory)
  async getHistory(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(CryptoHistoryQuery) query: CryptoHistoryQuery,
  ) {
    return this.cryptoService.getHistory(workspaceId, Math.min(query.days ?? 90, 1825));
  }

  /**
   * What was sold in a year and what it had cost — the rows a capital gains
   * return is built from. Without a year, the whole history.
   */
  @Get('gains')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(CryptoGains)
  async getGains(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(CryptoGainsQuery) query: CryptoGainsQuery,
  ) {
    return this.cryptoService.getGains(workspaceId, yearRange(query.year));
  }

  /**
   * The same sales, split by whose wallet they happened in. A tax allowance
   * belongs to a person, so two members' sales are never added into one.
   */
  @Get('gains/by-owner')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(CryptoGainsByOwner)
  async getGainsByOwner(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(CryptoGainsQuery) query: CryptoGainsQuery,
  ) {
    return this.cryptoService.getGainsByOwner(workspaceId, yearRange(query.year));
  }

  @Post('holdings')
  @WorkspaceAuth(Permission.WALLET_CREATE)
  @SchemaResponse(CryptoWallet)
  async upsertHolding(
    @SchemaBody(ManualHoldingBody) dto: ManualHoldingBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.cryptoService.upsertManualHolding(workspaceId, user.id, dto);
  }

  @Delete('holdings/:asset')
  @WorkspaceAuth(Permission.WALLET_DELETE)
  @SchemaResponse(CryptoRemoved)
  async removeHolding(
    @SchemaParams(CryptoHoldingParams) { asset }: CryptoHoldingParams,
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
  @SchemaResponse(ExchangeImportResult)
  async importExchangeCsv(
    // `unknown`, not `Express.Multer.File`: the decorator's emitted metadata would
    // reference a namespace that exists only in the type system.
    @UploadedFile() file: unknown,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    const path = uploadedPath(file);
    if (!path) {
      throw new BadRequestException(appError('CRYPTO_FILE_NOT_PROVIDED'));
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
  @SchemaResponse(CryptoWalletList)
  async connect(
    @SchemaBody(ConnectCryptoWalletBody) dto: ConnectCryptoWalletBody,
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
  @SchemaResponse(CryptoSyncResult)
  async sync(
    @SchemaParams(CryptoWalletParams) { id }: CryptoWalletParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.cryptoService.sync(workspaceId, id, user.id);
  }

  @Delete('wallets/:id')
  @WorkspaceAuth(Permission.WALLET_DELETE)
  @SchemaResponse(CryptoRemoved)
  async remove(
    @SchemaParams(CryptoWalletParams) { id }: CryptoWalletParams,
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
  return typeof path === 'string' && path.length > 0 ? resolveInUploadsDir(path) : null;
}

/** One calendar year, or no bounds (the whole history). */
function yearRange(year: number | undefined): { from?: string; to?: string } {
  return year === undefined ? {} : { from: `${year}-01-01`, to: `${year}-12-31` };
}
