import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { FileStorageService } from '../../common/services/file-storage.service';
import type { StatementsQuery } from '../../contracts';
import { Category } from '../../entities';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import {
  applyStatementFilters,
  applyStatementRowFilters,
  orderStatementList,
} from './statement-list-query';
import {
  EMPTY_TRANSACTION_SUMMARY,
  loadTransactionSummaries,
  type StatementTransactionSummary,
} from './statement-transaction-summary';

type StatementFileAvailability = Awaited<ReturnType<FileStorageService['getFileAvailability']>>;
type StatementWithFileAvailability = Statement & {
  hasFileOnDisk?: boolean;
  hasFileInDb?: boolean;
  fileAvailability?: StatementFileAvailability;
  transactionSummary?: StatementTransactionSummary;
};
type StatementRepositoryWithOptionalQueryBuilder = Repository<Statement> & {
  createQueryBuilder?: Repository<Statement>['createQueryBuilder'];
};

function attachFileAvailability<T extends Statement>(
  statement: T,
  availability: StatementFileAvailability,
): T & StatementWithFileAvailability {
  const statementWithAvailability = statement as T & StatementWithFileAvailability;
  statementWithAvailability.hasFileOnDisk = availability.onDisk;
  statementWithAvailability.hasFileInDb = availability.inDb;
  statementWithAvailability.fileAvailability = availability;
  return statementWithAvailability;
}

/**
 * Reading documents: the list (filtered, sorted, paged, with what it says
 * about each statement's rows) and one document with its rows. Each carries
 * where its file can be read from.
 */
@Injectable()
export class StatementListService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async list(
    workspaceId: string,
    filters: StatementsQuery = {},
    viewerMemberId: string | null = null,
  ): Promise<{
    data: Statement[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page;
    const limit = filters.limit ?? (page ? 20 : undefined);
    const qb = this.statementRepository
      .createQueryBuilder('statement')
      .leftJoinAndSelect('statement.user', 'user')
      .leftJoinAndSelect('statement.category', 'category')
      .leftJoinAndSelect('statement.tags', 'tags')
      .where('statement.deletedAt IS NULL')
      .andWhere('statement.workspaceId = :workspaceId', { workspaceId })
      .orderBy('statement.createdAt', 'DESC');

    if (page && limit) {
      qb.skip((page - 1) * limit).take(limit);
    } else if (!page && limit) {
      qb.take(limit);
    }

    applyStatementFilters(qb, filters);
    const categoryIds =
      filters.categoryId && filters.categoryId !== 'uncategorized'
        ? await this.categoryWithDescendants(workspaceId, filters.categoryId)
        : null;
    applyStatementRowFilters(qb, filters, this.transactionRepository, workspaceId, categoryIds);
    orderStatementList(qb, filters.groupBy);

    const [dataRaw, totalCount] = await qb.getManyAndCount();
    const transactionSummaries = await loadTransactionSummaries(
      this.transactionRepository,
      workspaceId,
      dataRaw.map(statement => statement.id),
      viewerMemberId,
    );
    const data = await Promise.all(
      dataRaw.map(async st => {
        const availability = await this.fileStorageService.getFileAvailability(st);
        const statement = attachFileAvailability(st, availability);
        statement.transactionSummary = transactionSummaries.get(st.id) ?? EMPTY_TRANSACTION_SUMMARY;
        return statement;
      }),
    );

    const total = page ? totalCount : data.length;

    return {
      data,
      total,
      page: page ?? 1,
      limit: limit ?? total,
    };
  }

  /** The category and every category below it, within the workspace. */
  private async categoryWithDescendants(
    workspaceId: string,
    categoryId: string,
  ): Promise<string[]> {
    const categories = await this.categoryRepository.find({
      where: { workspaceId },
      select: { id: true, parentId: true },
    });
    const ids = [categoryId];
    for (let index = 0; index < ids.length; index++) {
      for (const category of categories) {
        if (category.parentId === ids[index] && !ids.includes(category.id)) ids.push(category.id);
      }
    }
    return ids;
  }

  async findOne(id: string, workspaceId: string): Promise<Statement> {
    const statementRepository = this
      .statementRepository as StatementRepositoryWithOptionalQueryBuilder;

    if (typeof statementRepository.createQueryBuilder !== 'function') {
      const statement = await this.statementRepository.findOne({
        where: { id, workspaceId },
        relations: {
          transactions: true,
          user: true,
        },
      });

      if (!statement) {
        throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
      }

      const availability = await this.fileStorageService.getFileAvailability(statement);
      attachFileAvailability(statement, availability);

      return statement;
    }

    const qb = statementRepository
      .createQueryBuilder('statement')
      .leftJoinAndSelect('statement.transactions', 'transactions')
      .leftJoinAndSelect('statement.user', 'owner')
      .where('statement.id = :id', { id })
      .andWhere('statement.workspaceId = :workspaceId', { workspaceId });

    const statement = await qb.getOne();

    if (!statement) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }

    const availability = await this.fileStorageService.getFileAvailability(statement);
    attachFileAvailability(statement, availability);

    return statement;
  }
}
