import { Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { ReceiptParams, SetReceiptTagsBody, StorageTagList } from '../../contracts';
import { EntityType } from '../../entities/audit-event.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { ReceiptTagsService } from './services/receipt-tags.service';

/** The tags on one receipt. */
@Controller('receipts')
export class ReceiptTagsController {
  constructor(private readonly receiptTagsService: ReceiptTagsService) {}

  @Get(':id/tags')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: "The receipt's tags" })
  @SchemaResponse(StorageTagList)
  async getTags(
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.receiptTagsService.getTags(id, workspaceId);
  }

  @Put(':id/tags')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @Audit({ entityType: EntityType.RECEIPT, includeDiff: true })
  @ApiOperation({ summary: "Replace the receipt's tags; an empty list clears them" })
  @ApiResponse({ status: 400, description: 'A tag is not in this workspace' })
  @SchemaResponse(StorageTagList)
  async setTags(
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @SchemaBody(SetReceiptTagsBody) dto: SetReceiptTagsBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.receiptTagsService.setTags(id, workspaceId, dto.tagIds);
  }
}
