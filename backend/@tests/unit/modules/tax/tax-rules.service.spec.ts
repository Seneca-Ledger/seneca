import { createRepoMock } from '../../../helpers/create-repo-mock';
import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { TaxRuleDirection } from '@/entities/tax-rule.entity';
import { TaxRulesService } from '@/modules/tax/tax-rules.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TaxRulesService audit', () => {
  let service: TaxRulesService;
  let ruleRepo: ReturnType<typeof createRepoMock>;
  let rateRepo: ReturnType<typeof createRepoMock>;
  let categoryRepo: ReturnType<typeof createRepoMock>;
  let auditService: { createEvent: jest.Mock };

  const rule = {
    id: 'rule-1',
    workspaceId: 'ws-1',
    categoryId: 'cat-1',
    taxRateCode: 'KZ_STANDARD',
    priority: 0,
    direction: TaxRuleDirection.BOTH,
    isEnabled: true,
  };

  beforeEach(() => {
    ruleRepo = createRepoMock();
    rateRepo = createRepoMock();
    categoryRepo = createRepoMock();
    categoryRepo.findOne.mockResolvedValue({ id: 'cat-1', workspaceId: 'ws-1' });
    ruleRepo.create.mockImplementation((input: unknown) => input);
    ruleRepo.save.mockImplementation(async (input: object) => ({ id: 'rule-9', ...input }));
    rateRepo.findOne.mockResolvedValue({ id: 'rate-1', code: 'KZ_STANDARD' });
    auditService = { createEvent: jest.fn().mockResolvedValue(undefined) };
    service = new TaxRulesService(
      ruleRepo as never,
      rateRepo as never,
      auditService as never,
      categoryRepo as never,
    );
  });

  it('refuses a category of another workspace, on create and on update', async () => {
    ruleRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...rule });
    categoryRepo.findOne.mockResolvedValue(null);

    await expect(
      service.create('ws-1', { taxRateCode: 'KZ_STANDARD', categoryId: 'their-cat' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.update('rule-1', 'ws-1', { categoryId: 'their-cat' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(categoryRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'their-cat', workspaceId: 'ws-1' },
    });
    expect(ruleRepo.save).not.toHaveBeenCalled();
  });

  it('records a CREATE', async () => {
    ruleRepo.findOne.mockResolvedValue(null);

    await service.create('ws-1', { taxRateCode: 'KZ_STANDARD', categoryId: 'cat-1' }, 'user-1');

    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        entityType: EntityType.TAX_RULE,
        entityId: 'rule-9',
        action: AuditAction.CREATE,
        diff: {
          before: null,
          after: expect.objectContaining({ taxRateCode: 'KZ_STANDARD', categoryId: 'cat-1' }),
        },
      }),
    );
  });

  it('records an UPDATE with before and after', async () => {
    ruleRepo.findOne.mockResolvedValue({ ...rule });
    ruleRepo.save.mockImplementation(async (input: unknown) => input);

    await service.update('rule-1', 'ws-1', { priority: 5 }, 'user-1');

    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        entityId: 'rule-1',
        action: AuditAction.UPDATE,
        diff: {
          before: expect.objectContaining({ priority: 0 }),
          after: expect.objectContaining({ priority: 5 }),
        },
      }),
    );
  });

  it('records a DELETE', async () => {
    ruleRepo.findOne.mockResolvedValue({ ...rule });

    await service.remove('rule-1', 'ws-1', 'user-1');

    expect(ruleRepo.remove).toHaveBeenCalled();
    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        entityType: EntityType.TAX_RULE,
        entityId: 'rule-1',
        action: AuditAction.DELETE,
        diff: { before: expect.objectContaining({ taxRateCode: 'KZ_STANDARD' }), after: null },
      }),
    );
  });

  it('does not fail the write when the audit log fails', async () => {
    ruleRepo.findOne.mockResolvedValue(null);
    auditService.createEvent.mockRejectedValue(new Error('audit down'));

    await expect(
      service.create('ws-1', { taxRateCode: 'KZ_STANDARD' }, 'user-1'),
    ).resolves.toMatchObject({ id: 'rule-9' });
  });

  it('logs nothing when the write is refused', async () => {
    rateRepo.findOne.mockResolvedValue(null);

    await expect(service.create('ws-1', { taxRateCode: 'NOPE' }, 'user-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(auditService.createEvent).not.toHaveBeenCalled();
  });
});
