import {
  BadRequestException,
  Controller,
  forwardRef,
  Get,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { CommitImportBody, ImportSessionParams, StatementParams } from '../../contracts';
import {
  ImportSessionCancelled,
  ImportSessionSummary,
  StatementImportCommit,
  StatementImportPreview,
} from '../../contracts/imports/import-sessions';
import { Statement, StatementStatus } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { StatementProcessingService } from '../parsing/services/statement-processing.service';
import { ImportSessionService } from './services/import-session.service';

@Controller()
export class ImportSessionController {
  constructor(
    private readonly importSessionService: ImportSessionService,
    @Inject(forwardRef(() => StatementProcessingService))
    private readonly statementProcessingService: StatementProcessingService,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  @Get('import-sessions/:id')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(ImportSessionSummary)
  async getSessionSummary(
    @SchemaParams(ImportSessionParams) { id }: ImportSessionParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.importSessionService.getSessionSummary(id, workspaceId);
  }

  @Get('statements/:id/import-preview')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(StatementImportPreview)
  async getImportPreview(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @WorkspaceId() workspaceId: string,
  ) {
    const statement = await this.statementRepository.findOne({
      where: { id, workspaceId },
    });

    if (!statement) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }

    // Nothing else to check: this is a read endpoint (STATEMENT_VIEW), so it
    // must not trigger parsing itself if no preview was recorded — statement
    // processing is kicked off by the upload flow, not by viewing a preview.
    return {
      statementId: statement.id,
      status: statement.status,
      importPreview: statement.parsingDetails?.importPreview ?? null,
    };
  }

  @Post('statements/:id/import-commit')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(StatementImportCommit)
  async commitImport(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @SchemaBody(CommitImportBody) body: CommitImportBody,
    @WorkspaceId() workspaceId: string,
  ) {
    const statement = await this.statementRepository.findOne({
      where: { id, workspaceId },
    });

    if (!statement) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }

    const importPreview = statement.parsingDetails?.importPreview as
      | { sessionId?: string }
      | undefined;
    if (!importPreview?.sessionId) {
      if (statement.status === StatementStatus.COMPLETED) {
        return {
          statementId: statement.id,
          status: statement.status,
          importCommit: statement.parsingDetails?.importCommit ?? null,
        };
      }

      const transactionCount = await this.transactionRepository.count({
        where: { statementId: statement.id },
      });

      if (transactionCount > 0) {
        return {
          statementId: statement.id,
          status: statement.status,
          importCommit: statement.parsingDetails?.importCommit ?? null,
        };
      }
      throw new BadRequestException(appError('IMPORT_PREVIEW_SESSION_NOT_FOUND'));
    }

    if (body?.resolutions) {
      await this.importSessionService.resolveConflicts(
        importPreview.sessionId,
        workspaceId,
        body.resolutions,
      );
    }

    const committed = await this.statementProcessingService.commitImport(statement.id, workspaceId);

    return {
      statementId: committed.id,
      status: committed.status,
      importCommit: committed.parsingDetails?.importCommit ?? null,
    };
  }

  @Post('import-sessions/:id/cancel')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(ImportSessionCancelled)
  async cancelSession(
    @SchemaParams(ImportSessionParams) { id }: ImportSessionParams,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.importSessionService.cancelSession(id, workspaceId);
    return { cancelled: true };
  }
}
