import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CategorizationRule } from '../../../../src/entities/categorization-rule.entity';
import { WorkspaceMember } from '@/entities/workspace-member.entity';
import { AuditService } from '../../../../src/modules/audit/audit.service';
import { CategorizationRulesController } from '../../../../src/modules/classification/categorization-rules.controller';
import { RuleApplicationService } from '../../../../src/modules/classification/services/rule-application.service';
import { RuleOrderService } from '../../../../src/modules/classification/services/rule-order.service';

describe('CategorizationRulesController', () => {
  let controller: CategorizationRulesController;
  let ruleRepository: Repository<CategorizationRule>;

  const mockRuleRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    // A rule's targets are checked through it; here they are the workspace's.
    manager: { getRepository: () => ({ countBy: async ({ id }: any) => id.value.length }) },
  };

  const mockRuleApplicationService = {
    previewRule: vi.fn(),
    applyRuleToExisting: vi.fn(),
  };
  const mockAuditService = {
    createEvent: vi.fn(),
  };
  const mockRuleOrderService = {
    // The workspace's rules top out at 7, so a new one goes in at 8.
    topPriority: vi.fn(async () => 8),
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
          provide: getRepositoryToken(WorkspaceMember),
          useValue: { exists: vi.fn(async () => true) },
        },
        {
          provide: RuleApplicationService,
          useValue: mockRuleApplicationService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: RuleOrderService,
          useValue: mockRuleOrderService,
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it("should return every member's rules of the workspace", async () => {
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

      const result = await controller.findAll(mockWorkspaceId);

      expect(result.data).toEqual(mockRules);
      expect(result.total).toBe(2);
      // Every member's rules: they all shape the workspace's categories.
      expect(mockRuleRepository.find).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId },
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

      // No priority given: the new rule goes above every other one.
      expect(mockRuleOrderService.topPriority).toHaveBeenCalledWith(mockWorkspaceId);
      expect(mockRuleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 8,
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

      const result = await controller.update({ id: 'rule-1' }, updateDto, mockUser as any, mockWorkspaceId);

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
        controller.update({ id: 'nonexistent' }, {}, mockUser as any, mockWorkspaceId),
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
      // Like TypeORM: the removed entity comes back without its id.
      mockRuleRepository.remove.mockImplementation(async (removed: { id?: string }) => {
        removed.id = undefined;
        return removed;
      });

      await controller.remove({ id: 'rule-1' }, mockUser as any, mockWorkspaceId);

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
        controller.remove({ id: 'nonexistent' }, mockUser as any, mockWorkspaceId),
      ).rejects.toThrow('Categorization rule not found');
    });
  });

  describe('testRule', () => {
    it("hands the preview to the service with the caller's workspace and member", async () => {
      const preview = {
        totalTransactions: 3,
        matchedTransactions: 2,
        overridable: 1,
        truncated: false,
        matches: [],
      };
      mockRuleApplicationService.previewRule.mockResolvedValue(preview);
      const dto = {
        conditions: [
          { field: 'payment_purpose' as const, operator: 'contains' as const, value: 'salary' },
        ],
      };

      await expect(controller.testRule(dto, mockWorkspaceId, 'member-1')).resolves.toBe(preview);
      expect(mockRuleApplicationService.previewRule).toHaveBeenCalledWith({
        workspaceId: mockWorkspaceId,
        viewerMemberId: 'member-1',
        conditions: dto.conditions,
        transactionIds: undefined,
        ruleId: undefined,
      });
    });

    it('answers 400 for a pattern that does not compile', async () => {
      const dto = {
        conditions: [{ field: 'counterparty_name' as const, operator: 'regex' as const, value: '(' }],
      };

      await expect(controller.testRule(dto, mockWorkspaceId, null)).rejects.toThrow(
        'Invalid pattern',
      );
      expect(mockRuleApplicationService.previewRule).not.toHaveBeenCalled();
    });
  });

  describe('create with a broken pattern', () => {
    it('refuses to save it', async () => {
      const dto = {
        name: 'Broken',
        conditions: [{ field: 'counterparty_name' as const, operator: 'regex' as const, value: '[a-' }],
        result: { categoryId: 'cat-123' },
      };

      await expect(controller.create(dto, mockUser as any, mockWorkspaceId)).rejects.toThrow(
        'Invalid pattern',
      );
      expect(mockRuleRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('conditions that could never hold', () => {
    const create = (condition: { field: any; operator: any; value: string | number }) =>
      controller.create(
        { name: 'Rule', conditions: [condition], result: { categoryId: 'cat-123' } },
        mockUser as any,
        mockWorkspaceId,
      );

    it('refuses a direction other than income or expense', async () => {
      await expect(create({ field: 'direction', operator: 'equals', value: 'sideways' })).rejects.toThrow(
        'Invalid condition on direction',
      );
      expect(mockRuleRepository.save).not.toHaveBeenCalled();
    });

    it('refuses an amount that is not a number', async () => {
      await expect(create({ field: 'amount', operator: 'greater_than', value: 'lots' })).rejects.toThrow(
        'Invalid condition on amount',
      );
    });

    it("refuses an account or a tag of another workspace", async () => {
      // Every lookup finds nothing: the ids are someone else's.
      const manager = mockRuleRepository.manager;
      mockRuleRepository.manager = { getRepository: () => ({ countBy: async () => 0 }) };
      try {
        await expect(create({ field: 'wallet', operator: 'equals', value: 'wallet-b' })).rejects.toThrow();
        await expect(
          controller.create(
            {
              name: 'Rule',
              conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'acme' }],
              result: { tagIds: ['tag-b'] },
            },
            mockUser as any,
            mockWorkspaceId,
          ),
        ).rejects.toThrow();
      } finally {
        mockRuleRepository.manager = manager;
      }
      expect(mockRuleRepository.save).not.toHaveBeenCalled();
    });

    it('accepts a direction and an account of the workspace', async () => {
      mockRuleRepository.create.mockImplementation((rule: any) => ({
        ...rule,
        id: 'rule-new',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      }));
      mockRuleRepository.save.mockImplementation(async (rule: any) => rule);

      await expect(create({ field: 'direction', operator: 'equals', value: 'expense' })).resolves.toEqual(
        expect.objectContaining({ id: 'rule-new' }),
      );
      await expect(create({ field: 'wallet', operator: 'equals', value: 'wallet-a' })).resolves.toBeDefined();
    });
  });

  describe('applyRule', () => {
    it("applies a rule another member wrote, found in the caller's workspace only", async () => {
      const rule = {
        id: 'rule-1',
        userId: 'someone-else',
        workspaceId: mockWorkspaceId,
        result: { categoryId: 'cat-1' },
      };
      mockRuleRepository.findOne.mockResolvedValue(rule);
      mockRuleApplicationService.applyRuleToExisting.mockResolvedValue({
        applied: 4,
        skippedManual: 1,
      });

      await expect(
        controller.applyRule({ id: 'rule-1' }, mockUser as any, mockWorkspaceId, 'member-1'),
      ).resolves.toEqual({ applied: 4, skippedManual: 1 });
      expect(mockRuleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'rule-1', workspaceId: mockWorkspaceId },
      });
      expect(mockRuleApplicationService.applyRuleToExisting).toHaveBeenCalledWith({
        rule,
        userId: mockUser.id,
        viewerMemberId: 'member-1',
      });
    });

    it('applies a rule that only adds tags', async () => {
      const rule = { id: 'rule-1', workspaceId: mockWorkspaceId, result: { tagIds: ['tag-1'] } };
      mockRuleRepository.findOne.mockResolvedValue(rule);
      mockRuleApplicationService.applyRuleToExisting.mockResolvedValue({
        applied: 0,
        skippedManual: 0,
        tagged: 3,
      });

      await expect(
        controller.applyRule({ id: 'rule-1' }, mockUser as any, mockWorkspaceId, null),
      ).resolves.toEqual({ applied: 0, skippedManual: 0, tagged: 3 });
    });

    it('refuses a rule that sets neither a category nor tags', async () => {
      mockRuleRepository.findOne.mockResolvedValue({
        id: 'rule-1',
        workspaceId: mockWorkspaceId,
        result: { walletId: 'wallet-1' },
      });

      await expect(
        controller.applyRule({ id: 'rule-1' }, mockUser as any, mockWorkspaceId, null),
      ).rejects.toThrow('neither a category nor tags');
      expect(mockRuleApplicationService.applyRuleToExisting).not.toHaveBeenCalled();
    });

    it('is not found for a rule outside the workspace', async () => {
      mockRuleRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.applyRule({ id: 'rule-1' }, mockUser as any, mockWorkspaceId, null),
      ).rejects.toThrow('Categorization rule not found');
    });
  });
});
