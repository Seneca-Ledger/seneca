import { Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { multerConfig } from '../../config/multer.config';
import {
  WebhookReceiptAccepted,
  WebhookReceiptUploadBody,
  WebhookStatementAccepted,
  WebhookStatementUploadBody,
} from '../../contracts';
import type { WebhookEndpoint } from '../../entities/webhook-endpoint.entity';
import { Public } from '../auth/decorators/public.decorator';
import { WebhookTokenGuard } from './guards/webhook-token.guard';
import { WebhookInboundService } from './webhook-inbound.service';

type MulterFile = Express.Multer.File;

@ApiTags('Webhook Inbound')
@Controller('webhooks/:token')
@Public()
@UseGuards(WebhookTokenGuard)
export class WebhookInboundController {
  constructor(private readonly inboundService: WebhookInboundService) {}

  @Post('statements')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @ApiOperation({ summary: 'Upload statement via webhook token' })
  @SchemaResponse(WebhookStatementAccepted)
  async uploadStatement(
    @Req() req: Request & { webhookEndpoint: WebhookEndpoint },
    @UploadedFile() file: MulterFile | undefined,
    @SchemaBody(WebhookStatementUploadBody) dto: WebhookStatementUploadBody,
  ) {
    const result = await this.inboundService.uploadStatement(
      req.webhookEndpoint,
      file ?? null,
      dto,
    );
    return { success: true, statementId: result.id, status: result.status };
  }

  @Post('receipts')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @ApiOperation({ summary: 'Upload receipt via webhook token' })
  @SchemaResponse(WebhookReceiptAccepted)
  async uploadReceipt(
    @Req() req: Request & { webhookEndpoint: WebhookEndpoint },
    @UploadedFile() file: MulterFile | undefined,
    @SchemaBody(WebhookReceiptUploadBody) dto: WebhookReceiptUploadBody,
  ) {
    const result = await this.inboundService.uploadReceipt(req.webhookEndpoint, file ?? null, dto);
    return { success: true, receipts: [{ receiptId: result.id, status: result.status }] };
  }
}
