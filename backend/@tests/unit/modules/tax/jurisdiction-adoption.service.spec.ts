import { createRepoMock } from '../../../helpers/create-repo-mock';
import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { JurisdictionAdoptionService } from '@/modules/tax/jurisdiction-adoption.service';

describe('JurisdictionAdoptionService audit', () => {
  let service: JurisdictionAdoptionService;
  let rateRepo: ReturnType<typeof createRepoMock> & { manager: { transaction: jest.Mock } };
  let workspaceRepo: ReturnType<typeof createRepoMock>;
  let jurisdictions: { findByCode: jest.Mock; findAllRates: jest.Mock };
  let auditService: { createEvent: jest.Mock };

  beforeEach(() => {
    const builder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(builder),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      merge: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    rateRepo = Object.assign(createRepoMock(), {
      manager: { transaction: jest.fn(async (work: (m: unknown) => unknown) => work(manager)) },
    });
    workspaceRepo = createRepoMock();
    workspaceRepo.findOne.mockResolvedValue({ id: 'ws-1', taxJurisdiction: { code: 'KZ' } });
    jurisdictions = {
      findByCode: jest.fn().mockResolvedValue({ id: 'j-de', code: 'DE' }),
      findAllRates: jest.fn().mockResolvedValue([{ code: 'DE_STANDARD', validFrom: '2020-01-01' }]),
    };
    auditService = { createEvent: jest.fn().mockResolvedValue(undefined) };

    service = new JurisdictionAdoptionService(
      rateRepo as never,
      workspaceRepo as never,
      jurisdictions as never,
      auditService as never,
    );
  });

  it('records the jurisdiction switch against the workspace', async () => {
    await service.adopt('ws-1', 'DE', '2026-01-01', 'user-1');

    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        entityType: EntityType.WORKSPACE,
        entityId: 'ws-1',
        action: AuditAction.UPDATE,
        diff: { before: { taxJurisdiction: 'KZ' }, after: { taxJurisdiction: 'DE' } },
        meta: { effectiveFrom: '2026-01-01', adopted: 1, retired: 0 },
      }),
    );
  });

  it('does not fail the switch when the audit log fails', async () => {
    auditService.createEvent.mockRejectedValue(new Error('audit down'));

    await expect(service.adopt('ws-1', 'DE', '2026-01-01', 'user-1')).resolves.toMatchObject({
      jurisdictionCode: 'DE',
      adopted: 1,
    });
  });
});
