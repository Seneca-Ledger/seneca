import {
  type Statement,
  type Transaction,
  type User,
  type WorkspaceMember,
  WorkspaceRole,
} from '@/entities';
import { AuditService } from '@/modules/audit/audit.service';
import { TransactionsService } from '@/modules/transactions/transactions.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

function createRepoMock<T>() {
  return {
    findOne: jest.fn(),
    save: jest.fn(async (data: Partial<T>) => data as T),
    delete: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(),
  } as unknown as Repository<T> & Record<string, any>;
}

describe('TransactionsService', () => {
  const transactionRepository = createRepoMock<Transaction>();
  const statementRepository = createRepoMock<Statement>();
  const userRepository = createRepoMock<User>();
  const workspaceMemberRepository = createRepoMock<WorkspaceMember>();
  const cacheManager = { get: jest.fn(), set: jest.fn() };
  const auditService = { createEvent: jest.fn(), createBatchEvents: jest.fn() } as AuditService;

  let service: TransactionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TransactionsService(
      transactionRepository as any,
      statementRepository as any,
      userRepository as any,
      workspaceMemberRepository as any,
      { findOne: jest.fn(async () => null), create: jest.fn(x => x), save: jest.fn(async x => x) } as any,
      cacheManager as any,
      auditService as any,
    );
  });

  it('denies update when member has canEditStatements=false', async () => {
    userRepository.findOne = jest.fn(async () => ({
      id: 'u1',
      workspaceId: 'w1',
    }));
    workspaceMemberRepository.findOne = jest.fn(async () => ({
      role: WorkspaceRole.MEMBER,
      permissions: { canEditStatements: false },
    }));

    await expect(service.update('t1', 'w1', 'u1', { amount: 1 } as any)).rejects.toThrow(
      ForbiddenException,
    );
    expect(transactionRepository.findOne).not.toHaveBeenCalled();
  });

  it('recalculates amount and transactionType when debit/credit changes', async () => {
    userRepository.findOne = jest.fn(async () => ({
      id: 'u1',
      workspaceId: 'w1',
    }));
    workspaceMemberRepository.findOne = jest.fn(async () => ({
      role: WorkspaceRole.OWNER,
      permissions: null,
    }));
    transactionRepository.findOne = jest.fn(async () => ({
      id: 't1',
      debit: null,
      credit: null,
      amount: 0,
      statement: { userId: 'u1' },
    }));
    transactionRepository.save = jest.fn(async (tx: any) => tx);

    const updated = await service.update('t1', 'w1', 'u1', { debit: 100 } as any);

    expect(updated.amount).toBe(100);
    expect(updated.transactionType).toBe('expense');
  });

  it('calculates amount from amountForeign*exchangeRate when amount not provided', async () => {
    userRepository.findOne = jest.fn(async () => ({
      id: 'u1',
      workspaceId: 'w1',
    }));
    workspaceMemberRepository.findOne = jest.fn(async () => ({
      role: WorkspaceRole.ADMIN,
      permissions: null,
    }));
    transactionRepository.findOne = jest.fn(async () => ({
      id: 't1',
      amount: 0,
      debit: null,
      credit: null,
      statement: { userId: 'u1' },
    }));
    transactionRepository.save = jest.fn(async (tx: any) => tx);

    const updated = await service.update('t1', 'w1', 'u1', {
      amountForeign: 10,
      exchangeRate: 500,
    } as any);

    expect(updated.amount).toBe(5000);
  });

  it('returns transaction when found', async () => {
    transactionRepository.findOne = jest.fn(async () => ({
      id: 't1',
      workspaceId: 'w1',
    }));

    const result = await service.findOne('t1', 'w1');

    expect(result.id).toBe('t1');
  });

  it('throws NotFoundException if transaction does not exist', async () => {
    transactionRepository.findOne = jest.fn(async () => null);
    await expect(service.findOne('missing', 'w1')).rejects.toThrow(NotFoundException);
  });

  it('bulkUpdate returns only successfully updated transactions', async () => {
    userRepository.findOne = jest.fn(async () => ({
      id: 'u1',
      workspaceId: null,
    }));
    const updateSpy = jest
      .spyOn(service, 'update')
      .mockResolvedValueOnce({ id: 't-ok' } as any)
      .mockRejectedValueOnce(new Error('boom'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await service.bulkUpdate('w1', 'u1', [
      { id: 't-ok', updates: { amount: 1 } as any },
      { id: 't-fail', updates: { amount: 2 } as any },
    ]);

    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t-ok');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('remove deletes transaction after ownership check', async () => {
    userRepository.findOne = jest.fn(async () => ({
      id: 'u1',
      workspaceId: null,
    }));
    transactionRepository.findOne = jest.fn(async () => ({
      id: 't1',
      statement: { userId: 'u1' },
    }));

    await service.remove('t1', 'w1', 'u1');

    expect(transactionRepository.delete).toHaveBeenCalledWith('t1');
  });
});
