import { Statement } from '@/entities/statement.entity';
import { Transaction } from '@/entities/transaction.entity';
import { NotificationCategory, NotificationSeverity, NotificationType } from '@/entities/notification.entity';
import {
  Payable,
  PayableDirection,
  PayableSource,
  PayableStatus,
} from '@/entities/payable.entity';
import { PayablePayment } from '@/entities/payable-payment.entity';
import { Workspace } from '@/entities/workspace.entity';
import { ExchangeRatesService } from '@/modules/exchange-rates/exchange-rates.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { PayablesExportService } from '@/modules/payables/payables-export.service';
import { PayablesService } from '@/modules/payables/payables.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { workspaceCurrencyProvider } from '../../../helpers/workspace-currency-stub';

function createRepositoryMock<T extends object>() {
  const repository: any = {
    create: jest.fn((data: Partial<T>) => data as T),
    save: jest.fn(async (data: Partial<T>) => data as T),
    find: jest.fn(),
    findOne: jest.fn(),
    softRemove: jest.fn(async (data: Partial<T>) => data as T),
    createQueryBuilder: jest.fn(),
  };
  // markAsPaid locks the row in a transaction and writes the payment log;
  // route both back to the same mocks. `find` defaults to empty so a bill with
  // no payments reads as unpaid rather than throwing.
  repository.manager = {
    transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) =>
      work({
        getRepository: () => ({
          findOneOrFail: (...args: unknown[]) => repository.findOne(...args),
          findOne: (...args: unknown[]) => repository.findOne(...args),
          find: async (...args: unknown[]) => (await repository.find(...args)) ?? [],
          create: (...args: unknown[]) => repository.create(...args),
          save: (...args: unknown[]) => repository.save(...args),
          update: jest.fn(),
          delete: jest.fn(),
        }),
      }),
    ),
  };
  return repository as Repository<T>;
}

describe('PayablesService', () => {
  let testingModule: TestingModule;
  let service: PayablesService;
  let payableRepository: Repository<Payable>;
  let notificationsService: { createForWorkspaceMembers: jest.Mock };
  let exportService: { exportPayables: jest.Mock };
  let transactionRepository: Repository<Transaction>;
  let statementRepository: Repository<Statement>;
  let workspaceRepository: Repository<Workspace>;
  let exchangeRatesService: { getRate: jest.Mock };

  const transactionEntity = {
    id: 'tx-1',
    workspaceId: 'workspace-1',
  } as Transaction;

  const statementEntity = {
    id: 'statement-1',
    workspaceId: 'workspace-1',
  } as Statement;

  const payableEntity = {
    id: 'payable-1',
    workspaceId: 'workspace-1',
    createdById: 'user-1',
    vendor: 'Acme LLC',
    amount: 1000,
    currency: 'KZT',
    dueDate: new Date('2026-03-20T00:00:00.000Z'),
    status: PayableStatus.TO_PAY,
    linkedTransactionId: null,
    source: PayableSource.MANUAL,
    isRecurring: false,
    comment: 'March invoice',
    statementId: null,
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    updatedAt: new Date('2026-03-01T10:00:00.000Z'),
    deletedAt: null,
  } as Payable;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        PayablesService,
        workspaceCurrencyProvider(),
        {
          provide: getRepositoryToken(Payable),
          useValue: createRepositoryMock<Payable>(),
        },
        {
          provide: getRepositoryToken(PayablePayment),
          useValue: createRepositoryMock<PayablePayment>(),
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: createRepositoryMock<Transaction>(),
        },
        {
          provide: getRepositoryToken(Statement),
          useValue: createRepositoryMock<Statement>(),
        },
        {
          provide: getRepositoryToken(Workspace),
          useValue: createRepositoryMock<Workspace>(),
        },
        {
          provide: ExchangeRatesService,
          useValue: {
            getRate: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createForWorkspaceMembers: jest.fn(),
          },
        },
        {
          provide: PayablesExportService,
          useValue: {
            exportPayables: jest.fn(),
          },
        },
      ],
    }).compile();

    service = testingModule.get(PayablesService);
    payableRepository = testingModule.get(getRepositoryToken(Payable));
    transactionRepository = testingModule.get(getRepositoryToken(Transaction));
    statementRepository = testingModule.get(getRepositoryToken(Statement));
    workspaceRepository = testingModule.get(getRepositoryToken(Workspace));
    exchangeRatesService = testingModule.get(ExchangeRatesService);
    notificationsService = testingModule.get(NotificationsService);
    exportService = testingModule.get(PayablesExportService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue({ currency: 'KZT' } as Workspace);
    exchangeRatesService.getRate.mockResolvedValue(1);
  });

  afterAll(async () => {
    await testingModule.close();
  });

  describe('create', () => {
    it('creates a workspace-scoped payable with default status', async () => {
      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(payableRepository, 'save').mockResolvedValue(payableEntity);

      const result = await service.create('workspace-1', 'user-1', {
        vendor: 'Acme LLC',
        amount: 1000,
        currency: 'KZT',
        dueDate: '2026-03-20',
        comment: 'March invoice',
      });

      expect(result).toEqual(payableEntity);
      expect(payableRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          createdById: 'user-1',
          status: PayableStatus.TO_PAY,
          source: PayableSource.MANUAL,
        }),
      );
    });

    it('rejects linked transaction from another workspace', async () => {
      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create('workspace-1', 'user-1', {
          vendor: 'Acme LLC',
          amount: 1000,
          linkedTransactionId: 'tx-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects statement from another workspace', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create('workspace-1', 'user-1', {
          vendor: 'Acme LLC',
          amount: 1000,
          statementId: 'statement-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('returns filtered paginated payables and excludes archived by default', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[payableEntity], 1]),
      };
      jest.spyOn(payableRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as never);

      const result = await service.findAll('workspace-1', {
        status: PayableStatus.TO_PAY,
        page: 2,
        limit: 5,
      });

      expect(result).toEqual({
        data: [payableEntity],
        total: 1,
        page: 2,
        limit: 5,
        totalPages: 1,
      });
      expect(queryBuilder.where).toHaveBeenCalledWith('payable.workspaceId = :workspaceId', {
        workspaceId: 'workspace-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('payable.status != :archivedStatus', {
        archivedStatus: PayableStatus.ARCHIVED,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('payable.status = :status', {
        status: PayableStatus.TO_PAY,
      });
      expect(queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
    });

    it('defaults to payables and switches to receivables on request', async () => {
      const createQueryBuilder = () => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[payableEntity], 1]),
      });

      const defaultQuery = createQueryBuilder();
      jest.spyOn(payableRepository, 'createQueryBuilder').mockReturnValue(defaultQuery as never);
      await service.findAll('workspace-1', {});
      expect(defaultQuery.andWhere).toHaveBeenCalledWith('payable.direction = :direction', {
        direction: PayableDirection.PAYABLE,
      });

      const receivableQuery = createQueryBuilder();
      jest.spyOn(payableRepository, 'createQueryBuilder').mockReturnValue(receivableQuery as never);
      await service.findAll('workspace-1', { direction: PayableDirection.RECEIVABLE });
      expect(receivableQuery.andWhere).toHaveBeenCalledWith('payable.direction = :direction', {
        direction: PayableDirection.RECEIVABLE,
      });
    });

    it('searches both vendor and comment fields', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[payableEntity], 1]),
      };
      jest.spyOn(payableRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as never);

      await service.findAll('workspace-1', {
        search: 'office',
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(LOWER(payable.vendor) LIKE :search OR LOWER(COALESCE(payable.comment, \'\')) LIKE :search)',
        {
          search: '%office%',
        },
      );
    });
  });

  describe('findOne', () => {
    it('throws when payable is outside workspace', async () => {
      jest.spyOn(payableRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('payable-1', 'workspace-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates an existing payable in the workspace', async () => {
      jest.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(payableRepository, 'save').mockResolvedValue({
        ...payableEntity,
        vendor: 'New Vendor',
      });

      const result = await service.update('payable-1', 'workspace-1', 'user-1', {
        vendor: 'New Vendor',
      });

      expect(result.vendor).toBe('New Vendor');
    });

    it('sets paidAt only when status first becomes paid and preserves it on later edits', async () => {
      const existing = {
        ...payableEntity,
        status: PayableStatus.TO_PAY,
        paidAt: null,
      } as Payable;
      const saveSpy = jest.spyOn(payableRepository, 'save');
      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(transactionEntity);
      jest.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      jest.spyOn(payableRepository, 'findOne').mockResolvedValue(existing);
      saveSpy.mockResolvedValue({
        ...existing,
        status: PayableStatus.PAID,
        linkedTransactionId: 'tx-1',
        paidAt: new Date('2026-03-17T12:00:00.000Z'),
      } as Payable);

      await service.update('payable-1', 'workspace-1', 'user-1', {
        status: PayableStatus.PAID,
        linkedTransactionId: 'tx-1',
      });

      const firstSaved = saveSpy.mock.calls[0][0] as Payable;
      expect(firstSaved.paidAt).toEqual(new Date('2026-03-17T12:00:00.000Z'));

      saveSpy.mockClear();
      jest.spyOn(payableRepository, 'findOne').mockResolvedValue({
        ...existing,
        status: PayableStatus.PAID,
        linkedTransactionId: 'tx-1',
        paidAt: new Date('2026-03-17T12:00:00.000Z'),
      } as Payable);
      saveSpy.mockResolvedValue({
        ...existing,
        status: PayableStatus.PAID,
        linkedTransactionId: 'tx-1',
        paidAt: new Date('2026-03-17T12:00:00.000Z'),
        comment: 'later edit',
      } as Payable);

      await service.update('payable-1', 'workspace-1', 'user-1', {
        comment: 'later edit',
      });

      const secondSaved = saveSpy.mock.calls[0][0] as Payable;
      expect(secondSaved.paidAt).toEqual(new Date('2026-03-17T12:00:00.000Z'));
      jest.useRealTimers();
    });

    it('clears paidAt when status changes away from paid', async () => {
      jest.spyOn(payableRepository, 'findOne').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.PAID,
        paidAt: new Date('2026-03-10T12:00:00.000Z'),
      } as Payable);
      const saveSpy = jest.spyOn(payableRepository, 'save').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.TO_PAY,
        paidAt: null,
      } as Payable);

      await service.update('payable-1', 'workspace-1', 'user-1', {
        status: PayableStatus.TO_PAY,
      });

      const saved = saveSpy.mock.calls[0][0] as Payable;
      expect(saved.paidAt).toBeNull();
    });

    it('rejects cross-workspace linked transaction and statement on update', async () => {
      jest.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update('payable-1', 'workspace-1', 'user-1', {
          linkedTransactionId: 'tx-1',
        }),
      ).rejects.toThrow(BadRequestException);

      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(transactionEntity);
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update('payable-1', 'workspace-1', 'user-1', {
          statementId: 'statement-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('markAsPaid', () => {
    it('marks payable as paid, links transaction, and notifies workspace without manual audit event', async () => {
      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(transactionEntity);
      jest.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      jest.spyOn(payableRepository, 'save').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.PAID,
        linkedTransactionId: 'tx-1',
        paidAt: new Date('2026-03-17T12:00:00.000Z'),
      });
      jest.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.markAsPaid('payable-1', 'workspace-1', 'user-1', {
        linkedTransactionId: 'tx-1',
      });

      expect(result.status).toBe(PayableStatus.PAID);
      expect(result.linkedTransactionId).toBe('tx-1');
      expect(result.paidAt).toEqual(new Date('2026-03-17T12:00:00.000Z'));
      expect(notificationsService.createForWorkspaceMembers).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          actorId: 'user-1',
          type: NotificationType.PAYABLE_MARKED_PAID,
          category: NotificationCategory.WORKSPACE_ACTIVITY,
          severity: NotificationSeverity.INFO,
        }),
      );
      jest.useRealTimers();
    });

    it('returns saved payable even if notification creation fails', async () => {
      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(transactionEntity);
      jest.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      jest.spyOn(payableRepository, 'save').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.PAID,
        linkedTransactionId: 'tx-1',
        paidAt: new Date('2026-03-17T12:00:00.000Z'),
      });
      notificationsService.createForWorkspaceMembers.mockRejectedValue(new Error('notify failed'));
      jest.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.markAsPaid('payable-1', 'workspace-1', 'user-1', {
        linkedTransactionId: 'tx-1',
      });

      expect(result.status).toBe(PayableStatus.PAID);
      expect(result.paidAt).toEqual(new Date('2026-03-17T12:00:00.000Z'));
      jest.useRealTimers();
    });

    it('rejects linked transaction outside workspace when marking paid', async () => {
      jest.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.markAsPaid('payable-1', 'workspace-1', 'user-1', {
          linkedTransactionId: 'tx-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findPaymentCandidates', () => {
    it('offers only confirmed transactions as the payment of a bill', async () => {
      jest.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      const query = jest.fn(async () => []);
      (transactionRepository as unknown as { query: jest.Mock }).query = query;

      await service.findPaymentCandidates('payable-1', 'workspace-1');

      const [sql] = query.mock.calls[0] as unknown as [string];
      expect(sql).toContain('t.is_verified = true');
    });
  });

  describe('archive', () => {
    it('moves payable to archived status', async () => {
      jest.spyOn(payableRepository, 'findOne').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.PAID,
      });
      jest.spyOn(payableRepository, 'save').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.ARCHIVED,
      });

      const result = await service.archive('payable-1', 'workspace-1', 'user-1');

      expect(result.status).toBe(PayableStatus.ARCHIVED);
    });
  });

  describe('remove', () => {
    it('soft-removes a payable in the workspace', async () => {
      jest.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);

      await service.remove('payable-1', 'workspace-1', 'user-1');

      expect(payableRepository.softRemove).toHaveBeenCalledWith(payableEntity);
    });
  });

  describe('getSummary', () => {
    it('aggregates to-pay, overdue, due this week, and paid this month metrics', async () => {
      const rows = [
        {
          id: 'payable-to-pay',
          status: PayableStatus.TO_PAY,
          dueDate: new Date('2026-03-20T00:00:00.000Z'),
          amount: 1000,
          paidAt: null,
          updatedAt: new Date('2026-03-01T10:00:00.000Z'),
        },
        {
          id: 'payable-overdue',
          status: PayableStatus.OVERDUE,
          dueDate: new Date('2026-03-10T00:00:00.000Z'),
          amount: 2000,
          paidAt: null,
          updatedAt: new Date('2026-03-01T10:00:00.000Z'),
        },
        {
          id: 'payable-paid',
          status: PayableStatus.PAID,
          dueDate: new Date('2026-03-18T00:00:00.000Z'),
          amount: 3000,
          paidAt: new Date('2026-03-05T10:00:00.000Z'),
          updatedAt: new Date('2026-03-06T10:00:00.000Z'),
        },
      ] as Payable[];
      jest.spyOn(payableRepository, 'find').mockResolvedValue(rows);
      jest.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result).toEqual({
        toPay: 1000,
        overdue: 2000,
        dueThisWeek: 1000,
        paidThisMonth: 3000,
        paidTotal: 3000,
        toPayCount: 1,
        overdueCount: 1,
        paidTotalCount: 1,
      });
      jest.useRealTimers();
    });

    it('converts summary amounts from payable currency into workspace currency', async () => {
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue({ currency: 'USD' } as Workspace);
      jest
        .spyOn(payableRepository, 'find')
        .mockResolvedValue([
          {
            id: 'payable-kzt-paid',
            status: PayableStatus.PAID,
            dueDate: new Date('2026-03-18T00:00:00.000Z'),
            amount: 1000,
            currency: 'KZT',
            paidAt: new Date('2026-03-05T10:00:00.000Z'),
            updatedAt: new Date('2026-03-06T10:00:00.000Z'),
          },
          {
            id: 'payable-usd-to-pay',
            status: PayableStatus.TO_PAY,
            dueDate: new Date('2026-03-20T00:00:00.000Z'),
            amount: 10,
            currency: 'USD',
            paidAt: null,
            updatedAt: new Date('2026-03-01T10:00:00.000Z'),
          },
        ] as Payable[]);
      exchangeRatesService.getRate.mockResolvedValueOnce(0.002);
      jest.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result.toPay).toBe(10);
      expect(result.dueThisWeek).toBe(10);
      expect(result.paidThisMonth).toBe(2);
      expect(result.paidTotal).toBe(2);
      expect(exchangeRatesService.getRate).toHaveBeenCalledWith('KZT', 'USD', undefined, 'workspace-1');
      jest.useRealTimers();
    });

    it('converts summary amounts in the reverse currency direction', async () => {
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue({ currency: 'KZT' } as Workspace);
      jest.spyOn(payableRepository, 'find').mockResolvedValue([
        {
          id: 'payable-usd',
          status: PayableStatus.TO_PAY,
          dueDate: new Date('2026-03-20T00:00:00.000Z'),
          amount: 10,
          currency: 'USD',
          paidAt: null,
          updatedAt: new Date('2026-03-01T10:00:00.000Z'),
        },
      ] as Payable[]);
      exchangeRatesService.getRate.mockResolvedValueOnce(500);
      jest.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result.toPay).toBe(5000);
      expect(result.dueThisWeek).toBe(5000);
      expect(exchangeRatesService.getRate).toHaveBeenCalledWith('USD', 'KZT', undefined, 'workspace-1');
      jest.useRealTimers();
    });

    it('does not count paid items edited this month when paidAt is outside the month', async () => {
      const rows = [
        {
          id: 'payable-paid',
          status: PayableStatus.PAID,
          dueDate: new Date('2026-03-18T00:00:00.000Z'),
          amount: 3000,
          paidAt: new Date('2026-02-28T23:00:00.000Z'),
          updatedAt: new Date('2026-03-06T10:00:00.000Z'),
        },
      ] as Payable[];
      jest.spyOn(payableRepository, 'find').mockResolvedValue(rows);
      jest.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result.paidThisMonth).toBe(0);
      expect(result.paidTotal).toBe(3000);
      expect(result.paidTotalCount).toBe(1);
      jest.useRealTimers();
    });

    it('falls back to updatedAt for legacy paid items without paidAt', async () => {
      const rows = [
        {
          id: 'legacy-paid',
          status: PayableStatus.PAID,
          dueDate: new Date('2026-02-18T00:00:00.000Z'),
          amount: 2500,
          paidAt: null,
          updatedAt: new Date('2026-03-06T10:00:00.000Z'),
        },
      ] as Payable[];
      jest.spyOn(payableRepository, 'find').mockResolvedValue(rows);
      jest.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result.paidThisMonth).toBe(2500);
      expect(result.paidTotal).toBe(2500);
      expect(result.paidTotalCount).toBe(1);
      jest.useRealTimers();
    });

    it('treats past-due unpaid items as overdue immediately in summary', async () => {
      const rows = [
        {
          id: 'payable-past-due',
          status: PayableStatus.TO_PAY,
          dueDate: new Date('2026-03-10T00:00:00.000Z'),
          amount: 1500,
          paidAt: null,
          updatedAt: new Date('2026-03-01T10:00:00.000Z'),
        },
        {
          id: 'payable-scheduled',
          status: PayableStatus.SCHEDULED,
          dueDate: new Date('2026-03-19T00:00:00.000Z'),
          amount: 700,
          paidAt: null,
          updatedAt: new Date('2026-03-01T10:00:00.000Z'),
        },
      ] as Payable[];
      jest.spyOn(payableRepository, 'find').mockResolvedValue(rows);
      jest.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result).toEqual({
        toPay: 700,
        overdue: 1500,
        dueThisWeek: 700,
        paidThisMonth: 0,
        paidTotal: 0,
        toPayCount: 1,
        overdueCount: 1,
        paidTotalCount: 0,
      });
      jest.useRealTimers();
    });
  });

  describe('exportData', () => {
    it('passes filtered data to export service', async () => {
      const data = {
        filePath: '/tmp/payables.csv',
        fileName: 'payables.csv',
        contentType: 'text/csv',
      };
      jest.spyOn(service, 'getExportData').mockResolvedValue([payableEntity]);
      exportService.exportPayables.mockResolvedValue(data);

      const result = await service.exportData('workspace-1', {
        format: 'csv',
        status: PayableStatus.TO_PAY,
      });

      expect(service.getExportData).toHaveBeenCalledWith('workspace-1', {
        format: 'csv',
        status: PayableStatus.TO_PAY,
      });
      expect(exportService.exportPayables).toHaveBeenCalledWith([payableEntity], 'csv');
      expect(result).toEqual(data);
    });
  });

  describe('helper queries', () => {
    it('finds overdue payables and due-soon payables', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([payableEntity]),
      };
      jest.spyOn(payableRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as never);
      jest.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const overdue = await service.findOverduePayables();
      const dueSoon = await service.findDueSoonPayables(3);

      expect(overdue).toEqual([payableEntity]);
      expect(dueSoon).toEqual([payableEntity]);
      expect(queryBuilder.andWhere).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('detects overdue payables from status and due date', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      expect(
        service.isOverdue({
          status: PayableStatus.TO_PAY,
          dueDate: new Date('2026-03-10T00:00:00.000Z'),
        } as Payable),
      ).toBe(true);
      expect(
        service.isOverdue({
          status: PayableStatus.PAID,
          dueDate: new Date('2026-03-10T00:00:00.000Z'),
        } as Payable),
      ).toBe(false);

      jest.useRealTimers();
    });

    it('markOverduePayables only updates newly overdue rows', async () => {
      jest.spyOn(service, 'findOverduePayables').mockResolvedValue([
        { ...payableEntity, status: PayableStatus.TO_PAY } as Payable,
        { ...payableEntity, id: 'payable-2', status: PayableStatus.OVERDUE } as Payable,
      ]);
      const saveSpy = jest.spyOn(payableRepository, 'save').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.OVERDUE,
      });

      const result = await service.markOverduePayables();

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });
});
