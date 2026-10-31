import { Controller, Delete, Get, Put, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  ItemImage,
  ItemImageIdsQuery,
  ItemImageList,
  ItemImagePreviewParams,
  ItemImageSearchQuery,
  ItemImageSearchResults,
  ItemImageSubjectParams,
  MessageResult,
  SetItemImageBody,
} from '../../contracts';
import { ItemImagesService } from './item-images.service';
import { ItemKindsService } from './item-kinds.service';
import { WikidataImagesService } from './wikidata-images.service';

/**
 * Pictures of what a transaction or a bill was for. Lists ask for a page of
 * rows at once; the search reaches Wikidata only when the person opens it.
 */
@Controller('item-images')
export class ItemImagesController {
  constructor(
    private readonly itemImages: ItemImagesService,
    private readonly wikidata: WikidataImagesService,
    private readonly itemKinds: ItemKindsService,
  ) {}

  @Get('transactions')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @ApiOperation({
    summary: 'Pictures of these transactions, and the vendors of those that paid a subscription',
  })
  @SchemaResponse(ItemImageList)
  async forTransactions(
    @SchemaQuery(ItemImageIdsQuery) { ids }: ItemImageIdsQuery,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
  ) {
    const [images, vendors, kinds] = await Promise.all([
      this.itemImages.forTransactions(workspaceId, ids, memberId),
      this.itemImages.vendorsForTransactions(workspaceId, ids, memberId),
      this.itemKinds.forTransactions(workspaceId, ids, memberId),
    ]);
    return { images, vendors, kinds };
  }

  @Get('payables')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @ApiOperation({ summary: 'Pictures of these bills, their own or their payment’s' })
  @SchemaResponse(ItemImageList)
  async forPayables(
    @SchemaQuery(ItemImageIdsQuery) { ids }: ItemImageIdsQuery,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
  ) {
    const [images, kinds] = await Promise.all([
      this.itemImages.forPayables(workspaceId, ids, memberId),
      this.itemKinds.forPayables(workspaceId, ids),
    ]);
    return { images, kinds };
  }

  @Get('search')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @ApiOperation({ summary: 'Search Wikidata for items that have a picture' })
  @ApiResponse({ status: 502, description: 'Wikidata did not answer' })
  @SchemaResponse(ItemImageSearchResults)
  async search(@SchemaQuery(ItemImageSearchQuery) { q, lang }: ItemImageSearchQuery) {
    return this.wikidata.search(q, lang);
  }

  // Signed-in users only, but no workspace scope: a Commons picture is public
  // and carries no tenant data, and an <img> cannot send x-workspace-id.
  @Get('preview/:wikidataId')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @ApiOperation({ summary: 'Thumbnail of a search result' })
  @ApiResponse({ status: 200, description: 'A raster image' })
  @ApiResponse({ status: 404, description: 'The item has no picture' })
  async preview(
    @SchemaParams(ItemImagePreviewParams) { wikidataId }: ItemImagePreviewParams,
    @Res() res: Response,
  ) {
    const picture = await this.wikidata.picture(wikidataId);
    res.setHeader('Cache-Control', 'private, max-age=604800');
    res.setHeader('Content-Type', picture.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(picture.body);
  }

  @Put('transactions/:id')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @ApiOperation({ summary: "Set a transaction's picture" })
  @SchemaResponse(ItemImage)
  async setForTransaction(
    @SchemaParams(ItemImageSubjectParams) { id }: ItemImageSubjectParams,
    @SchemaBody(SetItemImageBody) { wikidataId, lang }: SetItemImageBody,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
  ) {
    return this.itemImages.set('transaction', workspaceId, id, wikidataId, memberId, lang);
  }

  @Delete('transactions/:id')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @ApiOperation({ summary: "Remove a transaction's picture" })
  @SchemaResponse(MessageResult)
  async removeForTransaction(
    @SchemaParams(ItemImageSubjectParams) { id }: ItemImageSubjectParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
  ) {
    await this.itemImages.remove('transaction', workspaceId, id, memberId);
    return deletedResponse('Picture');
  }

  @Put('payables/:id')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @ApiOperation({ summary: "Set a bill's picture" })
  @SchemaResponse(ItemImage)
  async setForPayable(
    @SchemaParams(ItemImageSubjectParams) { id }: ItemImageSubjectParams,
    @SchemaBody(SetItemImageBody) { wikidataId, lang }: SetItemImageBody,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
  ) {
    return this.itemImages.set('payable', workspaceId, id, wikidataId, memberId, lang);
  }

  @Delete('payables/:id')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @ApiOperation({ summary: "Remove a bill's picture" })
  @SchemaResponse(MessageResult)
  async removeForPayable(
    @SchemaParams(ItemImageSubjectParams) { id }: ItemImageSubjectParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
  ) {
    await this.itemImages.remove('payable', workspaceId, id, memberId);
    return deletedResponse('Picture');
  }
}
