import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CategorizationRule } from '../../../../src/entities/categorization-rule.entity';
import { Transaction } from '../../../../src/entities/transaction.entity';
import { WorkspaceMember } from '@/entities/workspace-member.entity';
import { AuditService } from '../../../../src/modules/audit/audit.service';
import { CategorizationRulesController } from '../../../../src/modules/classification/categorization-rules.controller';
import { ClassificationService } from '../../../../src/modules/classification/services/classification.service';

describe('CategorizationRulesController', () => {
  let controller: CategorizationRulesController;
  let ruleRepository: Repository<CategorizationRule>;
  let transactionRepository: Repository<Transaction>;
  let classificationService: ClassificationService;

  const mockRuleRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockTransactionRepository = {
    findByIds: jest.fn(),
  };

  const mockClassificationService = {
    matchesRule: jest.fn(),
  };
  const mockAuditService = {
    createEvent: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockWorkspaceId = 'workspace-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategorizationRulesController],
      providers: [
        {
          provide: getRepositoryToken(CategorizationRule),
          useValue: mockRuleRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: { exists: jest.fn(async () => true) },
        },
        {
          provide: ClassificationService,
          useValue: mockClassificationService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<CategorizationRulesController>(CategorizationRulesController);
    ruleRepository = module.get<Repository<CategorizationRule>>(
      getRepositoryToken(CategorizationRule),
    );
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    classificationService = module.get<ClassificationService>(ClassificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all categorization rules for user and workspace', async () => {
      const mockRules = [
        {
          id: 'rule1',
          userId: mockUser.id,
          workspaceId: mockWorkspaceId,
          name: 'Salary Rule',
          conditions: [{ field: 'payment_purpose', operator: 'contains', value: 'salary' }],
          result: { categoryId: 'cat1' },
          priority: 100,
          isActive: true,
        },
        {
          id: 'rule2',
          userId: mockUser.id,
          workspaceId: mockWorkspaceId,
          name: 'Rent Rule',
          conditions: [{ field: 'payment_purpose', operator: 'contains', value: 'rent' }],
          result: { categoryId: 'cat2' },
          priority: 90,
          isActive: true,
        },
      ];

      mockRuleRepository.find.mockResolvedValue(mockRules);

      const result = await controller.findAll(mockUser as any, mockWorkspaceId);

      expect(result.data).toEqual(mockRules);
      expect(result.total).toBe(2);
      expect(mockRuleRepository.find).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          workspaceId: mockWorkspaceId,
        },
        order: {
          priority: 'DESC',
          createdAt: 'DESC',
        },
      });
    });
  });

  describe('create', () => {
    it('should create a new categorization rule', async () => {
      const dto = {
        name: 'Test Rule',
        description: 'Test description',
        conditions: [
          { field: 'counterparty_name' as const, operator: 'contains' as const, value: 'Company' },
        ],
        result: { categoryId: 'cat-123' },
        priority: 50,
        isActive: true,
      };

      const createdRule = {
        id: 'rule-new',
        ...dto,
        userId: mockUser.id,
        workspaceId: mockWorkspaceId,
        matchCount: 0,
        lastMatchedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRuleRepository.create.mockReturnValue(createdRule);
      mockRuleRepository.save.mockResolvedValue(createdRule);

      const result = await controller.create(dto, mockUser as any, mockWorkspaceId);

      expect(result.id).toBe('rule-new');
      expect(mockAuditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entityType: 'rule',
          entityId: 'rule-new',
        }),
      );
      expect(mockRuleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          workspaceId: mockWorkspaceId,
          name: dto.name,
          conditions: dto.conditions,
          result: dto.result,
        }),
      );
      expect(mockRuleRepository.save).toHaveBeenCalled();
    });

    it('should set default values when not provided', async () => {
      const dto = {
        name: 'Minimal Rule',
        conditions: [{ field: 'amount' as const, operator: 'greater_than' as const, value: 1000 }],
        result: { categoryId: 'cat-123' },
      };

      const createdRule = {
        id: 'rule-new',
        userId: mockUser.id,
        workspaceId: mockWorkspaceId,
        name: dto.name,
        description: null,
        conditions: dto.conditions,
        result: dto.result,
        priority: 0,
        isActive: true,
        matchCount: 0,
        lastMatchedAt: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      mockRuleRepository.create.mockReturnValue(createdRule);
      mockRuleRepository.save.mockResolvedValue(createdRule);

      const result = await controller.create(dto, mockUser as any, mockWorkspaceId);

      expect(mockRuleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 0,
          isActive: true,
          description: null,
        }),
      );
    });
  });

  describe('update', () => {
    it('should update an existing rule', async () => {
      const existingRule = {
        id: 'rule-1',
        userId: mockUser.id,
        workspaceId: mockWorkspaceId,
        name: 'Old Name',
        priority: 50,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      const updateDto = {
        name: 'New Name',
        priority: 100,
      };

      mockRuleRepository.findOne.mockResolvedValue(existingRule);
      mockRuleRepository.save.mockResolvedValue({ ...existingRule, ...updateDto });

      const result = await controller.update('rule-1', updateDto, mockUser as any, mockWorkspaceId);

      expect(result.name).toBe('New Name');
      expect(result.priority).toBe(100);
      expect(mockAuditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entityType: 'rule',
          entityId: 'rule-1',
        }),
      );
    });

    it('should throw error if rule not found', async () => {
      mockRuleRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.update('nonexistent', {}, mockUser as any, mockWorkspaceId),
      ).rejects.toThrow('Categorization rule not found');
    });
  });

  describe('remove', () => {
    it('should delete a rule', async () => {
      const rule = {
        id: 'rule-1',
        userId: mockUser.id,
        workspaceId: mockWorkspaceId,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      };

      mockRuleRepository.findOne.mockResolvedValue(rule);
      mockRuleRepository.remove.mockResolvedValue(rule);

      await controller.remove('rule-1', mockUser as any, mockWorkspaceId);

      expect(mockRuleRepository.remove).toHaveBeenCalledWith(rule);
      expect(mockAuditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entityType: 'rule',
          entityId: 'rule-1',
        }),
      );
    });

    it('should throw error if rule not found', async () => {
      mockRuleRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.remove('nonexistent', mockUser as any, mockWorkspaceId),
      ).rejects.toThrow('Categorization rule not found');
    });
  });

  describe('testRule', () => {
    it('should test rule against transactions and return matches', async () => {
      const dto = {
        conditions: [
          { field: 'payment_purpose' as const, operator: 'contains' as const, value: 'salary' },
        ],
        transactionIds: ['tx1', 'tx2', 'tx3'],
      };

      const transactions = [
        {
          id: 'tx1',
          paymentPurpose: 'Monthly salary payment',
          counterpartyName: 'Company A',
          transactionDate: new Date('2024-01-15'),
          debit: 50000,
        },
        {
          id: 'tx2',
          paymentPurpose: 'Office rent',
          counterpartyName: 'Landlord B',
          transactionDate: new Date('2024-01-10'),
          debit: 20000,
        },
        {
          id: 'tx3',
          paymentPurpose: 'Salary advance',
          counterpartyName: 'Company A',
          transactionDate: new Date('2024-01-05'),
          debit: 15000,
        },
      ];

      mockTransactionRepository.findByIds.mockResolvedValue(transactions);

      // Mock the private matchesRule method
      (classificationService as any).matchesRule = jest.fn((transaction, conditions) => {
        return transaction.paymentPurpose.toLowerCase().includes('salary');
      });

      const result = await controller.testRule(dto, mockUser as any, mockWorkspaceId);

      expect(result.totalTransactions).toBe(3);
      expect(result.matchedTransactions).toBe(2);
      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].id).toBe('tx1');
      expect(result.matches[1].id).toBe('tx3');
    });

    it('should handle no matches', async () => {
      const dto = {
        conditions: [
          {
            field: 'payment_purpose' as const,
            operator: 'contains' as const,
            value: 'nonexistent',
          },
        ],
        transactionIds: ['tx1'],
      };

      const transactions = [
        {
          id: 'tx1',
          paymentPurpose: 'Some payment',
          counterpartyName: 'Company',
          transactionDate: new Date(),
          debit: 1000,
        },
      ];

      mockTransactionRepository.findByIds.mockResolvedValue(transactions);
      (classificationService as any).matchesRule = jest.fn(() => false);

      const result = await controller.testRule(dto, mockUser as any, mockWorkspaceId);

      expect(result.totalTransactions).toBe(1);
      expect(result.matchedTransactions).toBe(0);
      expect(result.matches).toHaveLength(0);
    });
  });
});
