import { createRepoMock } from '../../../helpers/create-repo-mock';
import { AuditAction, EntityType, Severity } from '@/entities/audit-event.entity';
import { IncomeTaxReturnStatus } from '@/entities/income-tax-return.entity';
import { IncomeTaxReturnsService } from '@/modules/income-tax/income-tax-returns.service';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('IncomeTaxReturnsService', () => {
  let service: IncomeTaxReturnsService;
  let returnRepo: ReturnType<typeof createRepoMock>;
  let draftService: { getContext: jest.Mock; compute: jest.Mock };
  let disclaimer: { assertAccepted: jest.Mock };
  let auditService: { createEvent: jest.Mock };

  const draft = { taxYear: 2025, status: 'draft', completeness: { score: 90 } };

  beforeEach(() => {
    returnRepo = createRepoMock();
    returnRepo.findOne.mockResolvedValue(null);
    returnRepo.save.mockImplementation(async (row: unknown) => row);
    draftService = {
      getContext: jest.fn().mockResolvedValue({
        jurisdiction: { id: 'j-de' },
        pack: { formKey: 'de-euer' },
      }),
      compute: jest.fn().mockResolvedValue(draft),
    };
    disclaimer = { assertAccepted: jest.fn().mockResolvedValue(undefined) };
    auditService = { createEvent: jest.fn().mockResolvedValue(undefined) };

    service = new IncomeTaxReturnsService(
      returnRepo as never,
      draftService as never,
      disclaimer as never,
      auditService as never,
    );
  });

  it('serves a finalized year from its snapshot, not from current data', async () => {
    const snapshot = { ...draft, status: 'finalized' };
    returnRepo.findOne.mockResolvedValue({ status: IncomeTaxReturnStatus.FINALIZED, snapshot });

    await expect(service.getDraft('ws-1', 2025)).resolves.toBe(snapshot);
    expect(draftService.compute).not.toHaveBeenCalled();
  });

  it('refuses to finalize before the disclaimer is accepted', async () => {
    disclaimer.assertAccepted.mockRejectedValue(new ForbiddenException());

    await expect(service.finalize('ws-1', 'user-1', 2025)).rejects.toThrow(ForbiddenException);
    expect(returnRepo.save).not.toHaveBeenCalled();
  });

  it('stores the whole draft as the snapshot', async () => {
    const result = await service.finalize('ws-1', 'user-1', 2025);

    expect(result).toMatchObject({ status: 'finalized', finalizedAt: expect.any(String) });
    expect(returnRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        jurisdictionId: 'j-de',
        formKey: 'de-euer',
        status: IncomeTaxReturnStatus.FINALIZED,
        finalizedBy: 'user-1',
        snapshot: result,
      }),
    );
  });

  it('refuses to finalize a year twice, including when two requests race', async () => {
    returnRepo.findOne.mockResolvedValueOnce({ status: IncomeTaxReturnStatus.FINALIZED });
    await expect(service.finalize('ws-1', 'user-1', 2025)).rejects.toThrow(ConflictException);

    returnRepo.save.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(service.finalize('ws-1', 'user-1', 2025)).rejects.toThrow(ConflictException);
  });

  it('reopens only a finalized year and clears its snapshot', async () => {
    await expect(service.reopen('ws-1', 2025)).rejects.toThrow(BadRequestException);

    returnRepo.findOne.mockResolvedValue({ id: 'r1', status: IncomeTaxReturnStatus.FINALIZED });
    await service.reopen('ws-1', 2025);

    expect(returnRepo.save).toHaveBeenCalledWith({
      id: 'r1',
      status: IncomeTaxReturnStatus.DRAFT,
      finalizedAt: null,
      finalizedBy: null,
      snapshot: null,
    });
  });

  it('audits finalize against the saved return row', async () => {
    returnRepo.save.mockImplementation(async (row: object) => ({ id: 'r1', ...row }));

    await service.finalize('ws-1', 'user-1', 2025);

    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        entityType: EntityType.TAX_RETURN,
        entityId: 'r1',
        action: AuditAction.UPDATE,
        diff: { before: { status: null }, after: { status: IncomeTaxReturnStatus.FINALIZED } },
        meta: { taxYear: 2025, formKey: 'de-euer' },
      }),
    );
    expect(auditService.createEvent.mock.calls[0][0].severity).toBeUndefined();
  });

  it('audits reopen as a warning', async () => {
    returnRepo.findOne.mockResolvedValue({ id: 'r1', status: IncomeTaxReturnStatus.FINALIZED });

    await service.reopen('ws-1', 2025, 'user-1');

    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        entityId: 'r1',
        action: AuditAction.UPDATE,
        severity: Severity.WARN,
        diff: {
          before: { status: IncomeTaxReturnStatus.FINALIZED },
          after: { status: IncomeTaxReturnStatus.DRAFT },
        },
        meta: { taxYear: 2025, formKey: 'de-euer' },
      }),
    );
  });

  it('does not fail finalize or reopen when the audit log fails', async () => {
    auditService.createEvent.mockRejectedValue(new Error('audit down'));
    returnRepo.save.mockImplementation(async (row: object) => ({ id: 'r1', ...row }));

    await expect(service.finalize('ws-1', 'user-1', 2025)).resolves.toMatchObject({
      status: 'finalized',
    });

    returnRepo.findOne.mockResolvedValue({ id: 'r1', status: IncomeTaxReturnStatus.FINALIZED });
    await expect(service.reopen('ws-1', 2025, 'user-1')).resolves.toBe(draft);
  });

  it('requires the disclaimer before exporting', async () => {
    disclaimer.assertAccepted.mockRejectedValue(new ForbiddenException());
    await expect(service.export('ws-1', 'user-1', 2025, 'xlsx')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
