import { randomUUID } from 'node:crypto';
import { Controller, HttpCode, HttpStatus, NotFoundException, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { redactPrivate } from '../../common/utils/transaction-privacy.util';
import { ClassifyBulkBody, ClassifyTransactionParams } from '../../contracts';
import {
  ClassifiedTransaction,
  ClassifyBulkResult,
} from '../../contracts/classification/categorization-rules';
import type { Tag } from '../../entities/tag.entity';
import { Transaction, TransactionCategorySource } from '../../entities/transaction.entity';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { addTransactionTags } from './engine/rule-tags';
import { ClassificationService } from './services/classification.service';

/** Re-running the rules rewrites a row's category, so it takes the right to edit transactions. */
@Controller('classification')
export class ClassificationController {
  constructor(
    private classificationService: ClassificationService,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  @Post('transaction/:id')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(ClassifiedTransaction)
  async classifyTransaction(
    @SchemaParams(ClassifyTransactionParams) { id }: ClassifyTransactionParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    const transaction = await this.transactionRepository.findOne({
      where: { id, workspaceId },
    });

    if (!transaction) {
      throw new NotFoundException(appError('CLASSIFICATION_TRANSACTION_NOT_FOUND'));
    }

    // A category picked by hand outranks the rules, as in the bulk re-run.
    if (transaction.categorySource === TransactionCategorySource.MANUAL) {
      return redactPrivate(transaction, selfMemberId);
    }

    const { tags, ...classification } = await this.classificationService.classifyTransaction(
      transaction,
      user.id,
    );

    Object.assign(transaction, classification);
    await this.transactionRepository.save(transaction);
    await this.addRuleTags(workspaceId, transaction.id, tags);

    return redactPrivate(transaction, selfMemberId);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(ClassifyBulkResult)
  async classifyBulk(
    @SchemaBody(ClassifyBulkBody) body: ClassifyBulkBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const { transactionIds } = body;
    const batchId = transactionIds.length > 1 ? randomUUID() : null;
    const results = {
      total: transactionIds.length,
      successful: 0,
      failed: 0,
      notFound: 0,
      /** Rows whose category the user picked by hand; re-classification never touches them. */
      keptManual: 0,
      errors: [] as { transactionId: string; error: string }[],
    };

    for (const transactionId of transactionIds) {
      try {
        const transaction = await this.transactionRepository.findOne({
          where: { id: transactionId, workspaceId },
        });

        if (!transaction) {
          results.notFound++;
          results.errors.push({
            transactionId,
            error: 'Transaction not found',
          });
          continue;
        }

        if (transaction.categorySource === TransactionCategorySource.MANUAL) {
          results.keptManual++;
          continue;
        }

        // Bypass the 5-minute cache: the point of a re-run is new rules or patterns.
        const { tags, ...classification } = await this.classificationService.classifyTransaction(
          transaction,
          user.id,
          batchId,
          { bypassCache: true },
        );

        // Check if categoryId was actually assigned
        if (!classification.categoryId) {
          results.failed++;
          results.errors.push({
            transactionId,
            error: 'Could not determine category - no matching rules or patterns found',
          });
          continue;
        }

        Object.assign(transaction, classification);
        await this.transactionRepository.save(transaction);
        await this.addRuleTags(workspaceId, transaction.id, tags);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          transactionId,
          error: (error instanceof Error && error.message) || 'Unknown error',
        });
      }
    }

    return results;
  }

  /** A rule's tags join the row's own: assigning the relation would drop those. */
  private addRuleTags(workspaceId: string, transactionId: string, tags: Tag[] | undefined) {
    return addTransactionTags(
      this.transactionRepository.manager,
      workspaceId,
      [transactionId],
      (tags ?? []).map(tag => tag.id),
    );
  }
}
