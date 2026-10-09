import { randomUUID } from 'node:crypto';
import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { Transaction, TransactionCategorySource } from '../../entities/transaction.entity';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClassifyBulkDto } from './dto/classification-body.dto';
import { ClassificationService } from './services/classification.service';

@Controller('classification')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class ClassificationController {
  constructor(
    private classificationService: ClassificationService,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
  ) {}

  @Post('transaction/:id')
  @HttpCode(HttpStatus.OK)
  async classifyTransaction(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const transaction = await this.transactionRepository.findOne({
      where: { id, workspaceId },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const classification = await this.classificationService.classifyTransaction(
      transaction,
      user.id,
    );

    Object.assign(transaction, classification);
    await this.transactionRepository.save(transaction);

    return transaction;
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  async classifyBulk(
    @Body() body: ClassifyBulkDto,
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
        const classification = await this.classificationService.classifyTransaction(
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
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          transactionId,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }
}
