import type { Mock } from 'vitest';
import { createRepoMock } from '../../../helpers/create-repo-mock';
import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { JurisdictionAdoptionService } from '@/modules/tax/jurisdiction-adoption.service';

describe('JurisdictionAdoptionService audit', () => {
  let service: JurisdictionAdoptionService;
  let rateRepo: ReturnType<typeof createRepoMock> & { manager: { transaction: Mock } };
  let workspaceRepo: ReturnType<typeof createRepoMock>;
  let jurisdictions: { findByCode: Mock; findAllRates: Mock };
  let auditService: { createEvent: Mock };

  beforeEach(() => {
    const builder = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ affected: 0 }),
    };
    const manager = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      merge: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    };
    rateRepo = Object.assign(createRepoMock(), {
      manager: { transaction: vi.fn(async (work: (m: unknown) => unknown) => work(manager)) },
    });
    workspaceRepo = createRepoMock();
    workspaceRepo.findOne.mockResolvedValue({ id: 'ws-1', taxJurisdiction: { code: 'KZ' } });
    jurisdictions = {
      findByCode: vi.fn().mockResolvedValue({ id: 'j-de', code: 'DE' }),
      findAllRates: vi.fn().mockResolvedValue([{ code: 'DE_STANDARD', validFrom: '2020-01-01' }]),
    };
    auditService = { createEvent: vi.fn().mockResolvedValue(undefined) };

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
