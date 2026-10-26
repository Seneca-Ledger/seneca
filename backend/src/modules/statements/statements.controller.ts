import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  Post,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { APP_SLUG } from '../../common/brand';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { HideInternalColumnsInterceptor } from '../../common/interceptors/hide-internal-columns.interceptor';
import { pipeFileStreamResponse } from '../../common/utils/stream-response.util';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import {
  ConvertDroppedSampleBody,
  DeleteStatementQuery,
  ReprocessStatementQuery,
  StatementDetail,
  StatementListPage,
  StatementParams,
  StatementsQuery,
  StatementThumbnailQuery,
  UpdateStatementBody,
  UpdateStatementStageBody,
} from '../../contracts';
import {
  DroppedSampleConverted,
  StatementRestored,
  StatementStageResult,
  StatementWritten,
} from '../../contracts/statements/statement-writes';
import { EntityType } from '../../entities/audit-event.entity';
import { StatementStage } from '../../entities/statement.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StatementStageService } from './services/statement-stage.service';
import { StatementsService } from './statements.service';

interface ThumbnailErrorLike {
  getStatus?: () => number;
  response?: { message?: string };
  message?: string;
}

@Controller('statements')
@UseInterceptors(HideInternalColumnsInterceptor)
export class StatementsController {
  private readonly logger = new Logger(StatementsController.name);

  constructor(
    private readonly statementsService: StatementsService,
    private readonly statementStageService: StatementStageService,
  ) {}

  private getThumbnailError(error: unknown): ThumbnailErrorLike {
    return typeof error === 'object' && error !== null ? (error as ThumbnailErrorLike) : {};
  }

  @Get('export-zip')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async exportZip(@WorkspaceId() workspaceId: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${APP_SLUG}-export.zip"`);
    await this.statementsService.exportZip(workspaceId, res);
  }

  @Get()
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(StatementListPage)
  async findAll(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(StatementsQuery) filters: StatementsQuery,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    const result = await this.statementsService.findAll(workspaceId, filters, selfMemberId ?? null);

    // Include 'items' field for backward compatibility
    return {
      ...result,
      items: result.data,
    };
  }

  // File routes must be defined before :id route to avoid conflicts
  @Get(':id/file')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async getFile(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { stream, fileName, mimeType } = await this.statementsService.getFileStream(
      id,
      workspaceId,
    );

    pipeFileStreamResponse(res, stream, {
      disposition: 'attachment',
      fileName,
      mimeType,
      errorMessage: 'Failed to download file',
    });
  }

  @Get(':id/view')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async viewFile(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { stream, fileName, mimeType } = await this.statementsService.getFileStream(
      id,
      workspaceId,
    );

    pipeFileStreamResponse(res, stream, {
      disposition: 'inline',
      fileName,
      mimeType,
      errorMessage: 'Failed to read file',
    });
  }

  @Get(':id/thumbnail')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async getThumbnail(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(StatementThumbnailQuery) { width }: StatementThumbnailQuery,
    @Res() res: Response,
  ) {
    try {
      const thumbnail = await this.statementsService.getThumbnail(id, workspaceId, width);
      res.setHeader('Content-Type', 'image/png');
      // Cache successful thumbnails for one week
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.send(thumbnail);
    } catch (error) {
      // Log full error details for diagnostics (includes stack when available)
      this.logger.error(`Thumbnail generation error for statement ${id}:`, error);
      const thumbnailError = this.getThumbnailError(error);

      // Try to infer HTTP status from Nest HttpException if present
      const statusCode =
        typeof thumbnailError.getStatus === 'function' ? thumbnailError.getStatus() : null;
      // Prefer structured response message when available, otherwise fallback to generic message
      const message =
        thumbnailError.response?.message || thumbnailError.message || 'Thumbnail not available';

      // If generation failed on the server side (transient), tell client to retry later and cache briefly
      if (
        (statusCode === HttpStatus.BAD_REQUEST &&
          String(message).toLowerCase().includes('failed to generate')) ||
        String(message).toLowerCase().includes('failed to generate')
      ) {
        // Suggest client to retry after 60 seconds and cache the negative result briefly to avoid hammering
        res.setHeader('Retry-After', '60');
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          error: {
            code: 'THUMBNAIL_GENERATION_FAILED',
            message: String(message),
          },
        });
        return;
      }

      // If the service indicated a bad request (e.g. not a PDF), forward a 400 with message
      if (statusCode === HttpStatus.BAD_REQUEST) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: {
            code: 'BAD_REQUEST',
            message: String(message),
          },
        });
        return;
      }

      // Default fallback: not found (thumbnail not available). Cache briefly to reduce repeated attempts.
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Retry-After', '60');
      res.status(HttpStatus.NOT_FOUND).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Thumbnail not available',
        },
      });
    }
  }

  // Audited per statement inside the service (one batch), since the body can hold many ids.
  @Post('stage')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Move one or more statements to a review-workflow stage' })
  @SchemaResponse(StatementStageResult)
  async updateStage(
    @SchemaBody(UpdateStatementStageBody) dto: UpdateStatementStageBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementStageService.updateStage(
      dto.statementIds,
      toEnum(StatementStage, dto.stage),
      user.id,
      workspaceId,
    );
  }

  @Post(':id/trash')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.STATEMENT_DELETE)
  @SchemaResponse(StatementWritten)
  async moveToTrash(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.moveToTrash(id, user.id, workspaceId);
  }

  @Post(':id/restore')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(StatementRestored)
  async restoreFile(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.restoreFile(id, user.id, workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(StatementDetail)
  async findOne(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    const statement = await this.statementsService.findOne(id, workspaceId);
    // A private row reads as a placeholder to all but its owner, here as in the list.
    redactPrivateRows(statement.transactions ?? [], selfMemberId);
    return statement;
  }

  @Patch(':id')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @Audit({ entityType: EntityType.STATEMENT, includeDiff: true, isUndoable: true })
  @SchemaResponse(StatementWritten)
  async update(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @SchemaBody(UpdateStatementBody) updateDto: UpdateStatementBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.updateMetadata(id, user.id, workspaceId, updateDto);
  }

  @Post(':id/convert-dropped-sample')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(DroppedSampleConverted)
  async convertDroppedSample(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @SchemaBody(ConvertDroppedSampleBody) payload: ConvertDroppedSampleBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.convertDroppedSampleToTransaction(
      id,
      user.id,
      workspaceId,
      payload,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(Permission.STATEMENT_DELETE)
  async remove(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(DeleteStatementQuery) { permanent }: DeleteStatementQuery,
  ) {
    if (permanent) {
      await this.statementsService.permanentDelete(id, user.id, workspaceId);
    } else {
      await this.statementsService.moveToTrash(id, user.id, workspaceId);
    }
  }

  @Post(':id/reprocess')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(StatementWritten)
  async reprocess(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(ReprocessStatementQuery) { mode }: ReprocessStatementQuery,
  ) {
    // Default to 'merge' mode to preserve user edits
    const reprocessMode = mode || 'merge';
    return this.statementsService.reprocess(id, user.id, workspaceId, reprocessMode);
  }

  @Post(':id/commit-import')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(StatementWritten)
  async commitImport(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.commitImport(id, user.id, workspaceId);
  }

  @Post(':id/confirm-balance')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(StatementWritten)
  async confirmBalance(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.confirmBalance(id, user.id, workspaceId);
  }
}
