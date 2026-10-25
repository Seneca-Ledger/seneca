import {
  BadRequestException,
  Controller,
  forwardRef,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { CommitImportBody } from '../../contracts';
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
  async getSessionSummary(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    const session = await this.importSessionService.getSession(id);
    if (session.workspaceId !== workspaceId) {
      throw new NotFoundException(appError('IMPORT_SESSION_NOT_FOUND'));
    }
    return this.importSessionService.getSessionSummary(id);
  }

  @Get('statements/:id/import-preview')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async getImportPreview(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
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
  async commitImport(
    @Param('id') id: string,
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
      await this.importSessionService.resolveConflicts(importPreview.sessionId, body.resolutions);
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
  async cancelSession(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    const session = await this.importSessionService.getSession(id);
    if (session.workspaceId !== workspaceId) {
      throw new NotFoundException(appError('IMPORT_SESSION_NOT_FOUND'));
    }
    await this.importSessionService.cancelSession(id);
    return { cancelled: true };
  }
}
