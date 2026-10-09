import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Receipt } from '../../../../src/entities/receipt.entity';
import { Subscription } from '../../../../src/entities/subscription.entity';
import { Transaction } from '../../../../src/entities/transaction.entity';
import { Statement } from '../../../../src/entities/statement.entity';
import { DuplicateDecision } from '../../../../src/modules/review-inbox/dto/review-inbox.dto';
import { ReviewInboxService } from '../../../../src/modules/review-inbox/review-inbox.service';
import { CrossStatementDeduplicationService } from '../../../../src/modules/transactions/services/cross-statement-deduplication.service';
import { TransactionsService } from '../../../../src/modules/transactions/transactions.service';

describe('ReviewInboxService', () => {
  let service: ReviewInboxService;
  const transactionRepository = { findOne: jest.fn(), update: jest.fn(), createQueryBuilder: jest.fn() };
  const transactionsService = { bulkUpdate: jest.fn() };
  const deduplicationService = { unmarkDuplicate: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ReviewInboxService,
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        { provide: getRepositoryToken(Receipt), useValue: { count: jest.fn(), findAndCount: jest.fn() } },
        { provide: getRepositoryToken(Subscription), useValue: { count: jest.fn(), findAndCount: jest.fn() } },
        { provide: getRepositoryToken(Statement), useValue: { findOne: jest.fn(async () => null) } },
        { provide: TransactionsService, useValue: transactionsService },
        { provide: CrossStatementDeduplicationService, useValue: deduplicationService },
      ],
    }).compile();
    service = module.get(ReviewInboxService);
  });

  it('approves through the ordinary update so the pick is manual, learned and audited', async () => {
    transactionsService.bulkUpdate.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

    const result = await service.approveTransactions('ws-1', 'u1', ['a', 'b'], 'cat-1');

    expect(result).toEqual({ approved: 2 });
    expect(transactionsService.bulkUpdate).toHaveBeenCalledWith('ws-1', 'u1', [
      { id: 'a', updates: { isVerified: true, categoryId: 'cat-1' } },
      { id: 'b', updates: { isVerified: true, categoryId: 'cat-1' } },
    ]);
  });

  it('approves as is without touching the category', async () => {
    transactionsService.bulkUpdate.mockResolvedValue([{ id: 'a' }]);

    await service.approveTransactions('ws-1', 'u1', ['a']);

    expect(transactionsService.bulkUpdate).toHaveBeenCalledWith('ws-1', 'u1', [
      { id: 'a', updates: { isVerified: true } },
    ]);
  });

  it('keeps a row by restoring it and confirms one by marking it reviewed', async () => {
    transactionRepository.findOne.mockResolvedValue({ id: 'd', workspaceId: 'ws-1' });

    await service.resolveDuplicate('ws-1', 'd', DuplicateDecision.KEEP);
    expect(deduplicationService.unmarkDuplicate).toHaveBeenCalledWith('d', 'ws-1');

    await service.resolveDuplicate('ws-1', 'd', DuplicateDecision.CONFIRM);
    expect(transactionRepository.update).toHaveBeenCalledWith(
      { id: 'd', workspaceId: 'ws-1' },
      { isVerified: true },
    );
  });

  it('does not see suspected duplicates of another workspace', async () => {
    transactionRepository.findOne.mockResolvedValue(null);
    await expect(service.resolveDuplicate('ws-2', 'd', DuplicateDecision.KEEP)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(transactionRepository.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'd', workspaceId: 'ws-2', isDuplicate: true }),
    });
  });
});
