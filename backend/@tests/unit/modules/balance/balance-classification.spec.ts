import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CapitalRole, RiskLevel } from '@/entities/balance-account.entity';
import { BalanceService } from '@/modules/balance/balance.service';

const WORKSPACE_ID = 'workspace-1';
const USER_ID = 'user-1';

function createService(account: Record<string, unknown> | null) {
  const balanceAccountRepository = {
    findOne: jest.fn(async () => account),
    save: jest.fn(async (data: unknown) => data),
  } as any;
  const auditService = { createEvent: jest.fn(async () => undefined) } as any;

  const service = new BalanceService(
    balanceAccountRepository,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    auditService,
    {} as any,
  );

  return { service, balanceAccountRepository, auditService };
}

describe('BalanceService.updateAccountClassification', () => {
  it('records the risk and role the user chose', async () => {
    const { service, balanceAccountRepository } = createService({
      id: 'account-1',
      code: 'ASSET_FIXED',
      capitalRole: null,
      riskLevel: null,
    });

    const result = await service.updateAccountClassification(USER_ID, WORKSPACE_ID, 'account-1', {
      capitalRole: CapitalRole.INCOME,
      riskLevel: RiskLevel.HIGH,
    });

    expect(result).toMatchObject({
      capitalRole: CapitalRole.INCOME,
      riskLevel: RiskLevel.HIGH,
    });
    expect(balanceAccountRepository.save).toHaveBeenCalled();
  });

  it('leaves the field the request did not mention alone', async () => {
    const { service } = createService({
      id: 'account-1',
      code: 'ASSET_FIXED',
      capitalRole: CapitalRole.DRAIN,
      riskLevel: RiskLevel.MEDIUM,
    });

    const result = await service.updateAccountClassification(USER_ID, WORKSPACE_ID, 'account-1', {
      riskLevel: RiskLevel.LOW,
    });

    expect(result.capitalRole).toBe(CapitalRole.DRAIN);
    expect(result.riskLevel).toBe(RiskLevel.LOW);
  });

  it('clears a classification back to unset when given null', async () => {
    const { service } = createService({
      id: 'account-1',
      code: 'ASSET_FIXED',
      capitalRole: CapitalRole.INCOME,
      riskLevel: RiskLevel.HIGH,
    });

    const result = await service.updateAccountClassification(USER_ID, WORKSPACE_ID, 'account-1', {
      riskLevel: null,
    });

    expect(result.riskLevel).toBeNull();
  });

  it('refuses to reclassify cash, the anchor the rule is measured against', async () => {
    const { service, auditService } = createService({
      id: 'account-cash',
      code: 'ASSET_CASH',
      capitalRole: null,
      riskLevel: null,
    });

    await expect(
      service.updateAccountClassification(USER_ID, WORKSPACE_ID, 'account-cash', {
        riskLevel: RiskLevel.HIGH,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(auditService.createEvent).not.toHaveBeenCalled();
  });

  it('refuses an account from another workspace', async () => {
    const { service } = createService(null);

    await expect(
      service.updateAccountClassification(USER_ID, WORKSPACE_ID, 'account-1', {
        riskLevel: RiskLevel.LOW,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('audits the change, since it decides whether the risk warning fires', async () => {
    const { service, auditService } = createService({
      id: 'account-1',
      code: 'ASSET_FIXED',
      capitalRole: null,
      riskLevel: RiskLevel.LOW,
    });

    await service.updateAccountClassification(USER_ID, WORKSPACE_ID, 'account-1', {
      riskLevel: RiskLevel.HIGH,
    });

    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        actorId: USER_ID,
        diff: {
          before: { capitalRole: null, riskLevel: RiskLevel.LOW },
          after: { capitalRole: null, riskLevel: RiskLevel.HIGH },
        },
      }),
    );
  });
});
