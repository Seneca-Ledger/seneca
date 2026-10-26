import type { Mock } from 'vitest';
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
import { Tag } from '@/entities/tag.entity';
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
    create: vi.fn((data: Partial<T>) => data as T),
    save: vi.fn(async (data: Partial<T>) => data as T),
    find: vi.fn(),
    findOne: vi.fn(),
    softRemove: vi.fn(async (data: Partial<T>) => data as T),
    createQueryBuilder: vi.fn(),
  };
  // markAsPaid locks the row in a transaction and writes the payment log;
  // route both back to the same mocks. `find` defaults to empty so a bill with
  // no payments reads as unpaid rather than throwing.
  repository.manager = {
    transaction: vi.fn(async (work: (manager: unknown) => Promise<unknown>) =>
      work({
        getRepository: () => ({
          findOneOrFail: (...args: unknown[]) => repository.findOne(...args),
          findOne: (...args: unknown[]) => repository.findOne(...args),
          find: async (...args: unknown[]) => (await repository.find(...args)) ?? [],
          create: (...args: unknown[]) => repository.create(...args),
          save: (...args: unknown[]) => repository.save(...args),
          update: vi.fn(),
          delete: vi.fn(),
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
  let notificationsService: { createForWorkspaceMembers: Mock };
  let exportService: { exportPayables: Mock };
  let transactionRepository: Repository<Transaction>;
  let statementRepository: Repository<Statement>;
  let workspaceRepository: Repository<Workspace>;
  let tagRepository: Repository<Tag>;
  let exchangeRatesService: { getRate: Mock };

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
          provide: getRepositoryToken(Tag),
          useValue: createRepositoryMock<Tag>(),
        },
        {
          provide: ExchangeRatesService,
          useValue: {
            getRate: vi.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createForWorkspaceMembers: vi.fn(),
          },
        },
        {
          provide: PayablesExportService,
          useValue: {
            exportPayables: vi.fn(),
          },
        },
      ],
    }).compile();

    service = testingModule.get(PayablesService);
    payableRepository = testingModule.get(getRepositoryToken(Payable));
    transactionRepository = testingModule.get(getRepositoryToken(Transaction));
    statementRepository = testingModule.get(getRepositoryToken(Statement));
    workspaceRepository = testingModule.get(getRepositoryToken(Workspace));
    tagRepository = testingModule.get(getRepositoryToken(Tag));
    exchangeRatesService = testingModule.get(ExchangeRatesService);
    notificationsService = testingModule.get(NotificationsService);
    exportService = testingModule.get(PayablesExportService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue({ currency: 'KZT' } as Workspace);
    exchangeRatesService.getRate.mockResolvedValue(1);
    // The list reads the tags of its page with `find`.
    vi.spyOn(payableRepository, 'find').mockResolvedValue([]);
  });

  afterAll(async () => {
    await testingModule.close();
  });

  describe('create', () => {
    it('creates a workspace-scoped payable with default status', async () => {
      vi.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(statementRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(payableRepository, 'save').mockResolvedValue(payableEntity);

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

    it('attaches the workspace tags it is given', async () => {
      const travel = { id: 'tag-1', name: 'Travel', color: null } as Tag;
      vi.spyOn(tagRepository, 'find').mockResolvedValue([travel]);
      vi.spyOn(payableRepository, 'save').mockResolvedValue(payableEntity);

      await service.create('workspace-1', 'user-1', {
        vendor: 'Acme LLC',
        amount: 1000,
        tagIds: [travel.id, travel.id],
      });

      expect(tagRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: 'workspace-1' }),
        }),
      );
      expect(payableRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: [travel] }),
      );
    });

    it('refuses a tag that is not in the workspace', async () => {
      vi.spyOn(tagRepository, 'find').mockResolvedValue([]);

      await expect(
        service.create('workspace-1', 'user-1', {
          vendor: 'Acme LLC',
          amount: 1000,
          tagIds: ['tag-of-another-workspace'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(payableRepository.save).not.toHaveBeenCalled();
    });

    it('rejects linked transaction from another workspace', async () => {
      vi.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create('workspace-1', 'user-1', {
          vendor: 'Acme LLC',
          amount: 1000,
          linkedTransactionId: 'tx-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects statement from another workspace', async () => {
      vi.spyOn(statementRepository, 'findOne').mockResolvedValue(null);

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
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[payableEntity], 1]),
      };
      vi.spyOn(payableRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as never);

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
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[payableEntity], 1]),
      });

      const defaultQuery = createQueryBuilder();
      vi.spyOn(payableRepository, 'createQueryBuilder').mockReturnValue(defaultQuery as never);
      await service.findAll('workspace-1', {});
      expect(defaultQuery.andWhere).toHaveBeenCalledWith('payable.direction = :direction', {
        direction: PayableDirection.PAYABLE,
      });

      const receivableQuery = createQueryBuilder();
      vi.spyOn(payableRepository, 'createQueryBuilder').mockReturnValue(receivableQuery as never);
      await service.findAll('workspace-1', { direction: PayableDirection.RECEIVABLE });
      expect(receivableQuery.andWhere).toHaveBeenCalledWith('payable.direction = :direction', {
        direction: PayableDirection.RECEIVABLE,
      });
    });

    it('narrows to a tag and answers each row with its tags', async () => {
      const travel = { id: 'tag-1', name: 'Travel', color: null } as Tag;
      const office = { id: 'tag-2', name: 'Office', color: '#336699' } as Tag;
      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[{ ...payableEntity }], 1]),
      };
      vi.spyOn(payableRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as never);
      vi
        .spyOn(payableRepository, 'find')
        .mockResolvedValue([{ id: payableEntity.id, tags: [travel, office] } as Payable]);

      const result = await service.findAll('workspace-1', { tagId: travel.id });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('payable_tags'),
        { tagId: travel.id },
      );
      expect(payableRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: 'workspace-1' }),
        }),
      );
      // Sorted by name, like everywhere else tags are listed.
      expect(result.data[0].tags).toEqual([office, travel]);
    });

    it('searches both vendor and comment fields', async () => {
      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[payableEntity], 1]),
      };
      vi.spyOn(payableRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as never);

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
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('payable-1', 'workspace-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates an existing payable in the workspace', async () => {
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      vi.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(statementRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(payableRepository, 'save').mockResolvedValue({
        ...payableEntity,
        vendor: 'New Vendor',
      });

      const result = await service.update('payable-1', 'workspace-1', 'user-1', {
        vendor: 'New Vendor',
      });

      expect(result.vendor).toBe('New Vendor');
    });

    it('replaces the tags only when a tag list is sent', async () => {
      const travel = { id: 'tag-1', name: 'Travel', color: null } as Tag;
      const office = { id: 'tag-2', name: 'Office', color: null } as Tag;
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue({ ...payableEntity, tags: [travel] });
      vi.spyOn(tagRepository, 'find').mockResolvedValue([office]);

      await service.update('payable-1', 'workspace-1', 'user-1', { vendor: 'New Vendor' });
      expect(payableRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ tags: [travel] }),
      );

      vi.spyOn(payableRepository, 'findOne').mockResolvedValue({ ...payableEntity, tags: [travel] });
      await service.update('payable-1', 'workspace-1', 'user-1', { tagIds: [office.id] });
      const saved = (payableRepository.save as Mock).mock.lastCall[0];
      expect(saved.tags).toEqual([office]);
      expect(saved).not.toHaveProperty('tagIds');
    });

    // An open bill turns paid only through a payment (see the integration test);
    // a bill already paid keeps the day it was paid through later edits.
    it('preserves paidAt on later edits of a paid bill', async () => {
      const paidAt = new Date('2026-03-17T12:00:00.000Z');
      const existing = {
        ...payableEntity,
        status: PayableStatus.PAID,
        linkedTransactionId: 'tx-1',
        paidAt,
      } as Payable;
      const saveSpy = vi.spyOn(payableRepository, 'save');
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue(existing);
      saveSpy.mockResolvedValue({ ...existing, comment: 'later edit' } as Payable);

      await service.update('payable-1', 'workspace-1', 'user-1', {
        status: PayableStatus.PAID,
        comment: 'later edit',
      });

      expect((saveSpy.mock.calls[0][0] as Payable).paidAt).toEqual(paidAt);
    });

    it('refuses to turn an open bill paid by an edit', async () => {
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.TO_PAY,
        paidAt: null,
      } as Payable);
      const saveSpy = vi.spyOn(payableRepository, 'save');

      await expect(
        service.update('payable-1', 'workspace-1', 'user-1', { status: PayableStatus.PAID }),
      ).rejects.toThrow(BadRequestException);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('clears paidAt when status changes away from paid', async () => {
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.PAID,
        paidAt: new Date('2026-03-10T12:00:00.000Z'),
      } as Payable);
      const saveSpy = vi.spyOn(payableRepository, 'save').mockResolvedValue({
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
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      vi.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update('payable-1', 'workspace-1', 'user-1', {
          linkedTransactionId: 'tx-1',
        }),
      ).rejects.toThrow(BadRequestException);

      vi.spyOn(transactionRepository, 'findOne').mockResolvedValue(transactionEntity);
      vi.spyOn(statementRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update('payable-1', 'workspace-1', 'user-1', {
          statementId: 'statement-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('markAsPaid', () => {
    it('marks payable as paid, links transaction, and notifies workspace without manual audit event', async () => {
      vi.spyOn(transactionRepository, 'findOne').mockResolvedValue(transactionEntity);
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      vi.spyOn(payableRepository, 'save').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.PAID,
        linkedTransactionId: 'tx-1',
        paidAt: new Date('2026-03-17T12:00:00.000Z'),
      });
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

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
      vi.useRealTimers();
    });

    it('returns saved payable even if notification creation fails', async () => {
      vi.spyOn(transactionRepository, 'findOne').mockResolvedValue(transactionEntity);
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      vi.spyOn(payableRepository, 'save').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.PAID,
        linkedTransactionId: 'tx-1',
        paidAt: new Date('2026-03-17T12:00:00.000Z'),
      });
      notificationsService.createForWorkspaceMembers.mockRejectedValue(new Error('notify failed'));
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.markAsPaid('payable-1', 'workspace-1', 'user-1', {
        linkedTransactionId: 'tx-1',
      });

      expect(result.status).toBe(PayableStatus.PAID);
      expect(result.paidAt).toEqual(new Date('2026-03-17T12:00:00.000Z'));
      vi.useRealTimers();
    });

    it('rejects linked transaction outside workspace when marking paid', async () => {
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      vi.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.markAsPaid('payable-1', 'workspace-1', 'user-1', {
          linkedTransactionId: 'tx-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findPaymentCandidates', () => {
    it('offers only confirmed transactions as the payment of a bill', async () => {
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);
      const query = vi.fn(async () => []);
      (transactionRepository as unknown as { query: Mock }).query = query;

      await service.findPaymentCandidates('payable-1', 'workspace-1');

      const [sql] = query.mock.calls[0] as unknown as [string];
      expect(sql).toContain('t.is_verified = true');
    });
  });

  describe('archive', () => {
    it('moves payable to archived status', async () => {
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.PAID,
      });
      vi.spyOn(payableRepository, 'save').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.ARCHIVED,
      });

      const result = await service.archive('payable-1', 'workspace-1', 'user-1');

      expect(result.status).toBe(PayableStatus.ARCHIVED);
    });
  });

  describe('remove', () => {
    it('soft-removes a payable in the workspace', async () => {
      vi.spyOn(payableRepository, 'findOne').mockResolvedValue(payableEntity);

      await service.remove('payable-1', 'workspace-1', 'user-1');

      expect(payableRepository.softRemove).toHaveBeenCalledWith(payableEntity);
    });
  });

  describe('getSummary', () => {
    it('aggregates to-pay, overdue, due this week, and paid this month metrics', async () => {
      // Bills and workspace in one currency: this is about adding up, not converting.
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue({ currency: 'USD' } as Workspace);
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
      vi.spyOn(payableRepository, 'find').mockResolvedValue(rows);
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

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
        dueThisWeekCount: 1,
        unbookedTotal: 0,
        unbookedCount: 0,
        convertedCurrencies: [],
      });
      vi.useRealTimers();
    });

    it('converts summary amounts from payable currency into workspace currency', async () => {
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue({ currency: 'USD' } as Workspace);
      vi
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
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result.toPay).toBe(10);
      expect(result.dueThisWeek).toBe(10);
      expect(result.paidThisMonth).toBe(2);
      expect(result.paidTotal).toBe(2);
      expect(exchangeRatesService.getRate).toHaveBeenCalledWith('KZT', 'USD', undefined, 'workspace-1');
      vi.useRealTimers();
    });

    it('converts summary amounts in the reverse currency direction', async () => {
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue({ currency: 'KZT' } as Workspace);
      vi.spyOn(payableRepository, 'find').mockResolvedValue([
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
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result.toPay).toBe(5000);
      expect(result.dueThisWeek).toBe(5000);
      expect(exchangeRatesService.getRate).toHaveBeenCalledWith('USD', 'KZT', undefined, 'workspace-1');
      vi.useRealTimers();
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
      vi.spyOn(payableRepository, 'find').mockResolvedValue(rows);
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result.paidThisMonth).toBe(0);
      expect(result.paidTotal).toBe(3000);
      expect(result.paidTotalCount).toBe(1);
      vi.useRealTimers();
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
      vi.spyOn(payableRepository, 'find').mockResolvedValue(rows);
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result.paidThisMonth).toBe(2500);
      expect(result.paidTotal).toBe(2500);
      expect(result.paidTotalCount).toBe(1);
      vi.useRealTimers();
    });

    it('counts what is still owed on a partly paid bill, and what it brought in', async () => {
      const rows = [
        {
          id: 'partly-overdue',
          status: PayableStatus.PARTIALLY_PAID,
          dueDate: new Date('2026-03-10T00:00:00.000Z'),
          amount: 1000,
          paidAmount: 400,
          paidAt: null,
          updatedAt: new Date('2026-03-01T10:00:00.000Z'),
        },
        {
          id: 'partly-due-later',
          status: PayableStatus.PARTIALLY_PAID,
          dueDate: new Date('2026-04-30T00:00:00.000Z'),
          amount: 500,
          paidAmount: 100,
          paidAt: null,
          updatedAt: new Date('2026-03-01T10:00:00.000Z'),
        },
      ] as Payable[];
      vi.spyOn(payableRepository, 'find').mockResolvedValue(rows);
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result).toMatchObject({
        overdue: 600,
        overdueCount: 1,
        toPay: 400,
        toPayCount: 1,
        paidTotal: 500,
        paidTotalCount: 2,
        paidThisMonth: 0,
      });
      vi.useRealTimers();
    });

    it('names the currencies it converted, so the totals can say so', async () => {
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue({ currency: 'USD' } as Workspace);
      vi.spyOn(payableRepository, 'find').mockResolvedValue([
        {
          id: 'ils',
          status: PayableStatus.PAID,
          dueDate: new Date('2026-03-05T00:00:00.000Z'),
          amount: 3500,
          currency: 'ILS',
          paidAt: new Date('2026-03-05T10:00:00.000Z'),
          updatedAt: new Date('2026-03-05T10:00:00.000Z'),
        },
        {
          id: 'usd',
          status: PayableStatus.TO_PAY,
          dueDate: new Date('2026-03-20T00:00:00.000Z'),
          amount: 10,
          currency: 'USD',
          paidAt: null,
          updatedAt: new Date('2026-03-01T10:00:00.000Z'),
        },
      ] as Payable[]);
      exchangeRatesService.getRate.mockResolvedValue(0.3);
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const result = await service.getSummary('workspace-1');

      expect(result.convertedCurrencies).toEqual(['ILS']);
      expect(result.paidTotal).toBeCloseTo(1050);
      vi.useRealTimers();
    });

    it('treats past-due unpaid items as overdue immediately in summary', async () => {
      // Bills and workspace in one currency: this is about adding up, not converting.
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue({ currency: 'USD' } as Workspace);
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
      vi.spyOn(payableRepository, 'find').mockResolvedValue(rows);
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

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
        dueThisWeekCount: 1,
        unbookedTotal: 0,
        unbookedCount: 0,
        convertedCurrencies: [],
      });
      vi.useRealTimers();
    });
  });

  describe('exportData', () => {
    it('passes filtered data to export service', async () => {
      const data = {
        filePath: '/tmp/payables.csv',
        fileName: 'payables.csv',
        contentType: 'text/csv',
      };
      vi.spyOn(service, 'getExportData').mockResolvedValue([payableEntity]);
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
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([payableEntity]),
      };
      vi.spyOn(payableRepository, 'createQueryBuilder').mockReturnValue(queryBuilder as never);
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

      const overdue = await service.findOverduePayables();
      const dueSoon = await service.findDueSoonPayables(3);

      expect(overdue).toEqual([payableEntity]);
      expect(dueSoon).toEqual([payableEntity]);
      expect(queryBuilder.andWhere).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('detects overdue payables from status and due date', () => {
      vi.useFakeTimers().setSystemTime(new Date('2026-03-17T12:00:00.000Z'));

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

      vi.useRealTimers();
    });

    it('markOverduePayables only updates newly overdue rows', async () => {
      vi.spyOn(service, 'findOverduePayables').mockResolvedValue([
        { ...payableEntity, status: PayableStatus.TO_PAY } as Payable,
        { ...payableEntity, id: 'payable-2', status: PayableStatus.OVERDUE } as Payable,
      ]);
      const saveSpy = vi.spyOn(payableRepository, 'save').mockResolvedValue({
        ...payableEntity,
        status: PayableStatus.OVERDUE,
      });

      const result = await service.markOverduePayables();

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });
});
