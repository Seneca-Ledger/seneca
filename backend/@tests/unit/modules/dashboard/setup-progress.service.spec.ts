import { IsNull } from 'typeorm';
import { CategorySource } from '@/entities/category.entity';
import { SetupProgressService } from '@/modules/dashboard/setup-progress.service';

function repo(found: boolean) {
  return { exists: jest.fn(async () => found) };
}

function build(found: Partial<Record<'statement' | 'receipt' | 'category' | 'rule' | 'budget' | 'goal', boolean>>) {
  const repos = {
    statement: repo(found.statement ?? false),
    receipt: repo(found.receipt ?? false),
    category: repo(found.category ?? false),
    rule: repo(found.rule ?? false),
    budget: repo(found.budget ?? false),
    goal: repo(found.goal ?? false),
  };
  const service = new SetupProgressService(
    repos.statement as any,
    repos.receipt as any,
    repos.category as any,
    repos.rule as any,
    repos.budget as any,
    repos.goal as any,
  );
  return { service, repos };
}

describe('SetupProgressService', () => {
  it('reports nothing done for an empty workspace', async () => {
    const { service } = build({});
    await expect(service.getSetupProgress('ws-1')).resolves.toEqual({
      hasUpload: false,
      hasCustomCategories: false,
      hasBudget: false,
      hasGoal: false,
    });
  });

  it('counts a receipt alone as an upload', async () => {
    const { service } = build({ receipt: true });
    await expect(service.getSetupProgress('ws-1')).resolves.toMatchObject({ hasUpload: true });
  });

  it('counts a statement as an upload', async () => {
    const { service } = build({ statement: true });
    await expect(service.getSetupProgress('ws-1')).resolves.toMatchObject({ hasUpload: true });
  });

  it('counts either a user category or a rule as customized categories', async () => {
    await expect(build({ category: true }).service.getSetupProgress('ws-1')).resolves.toMatchObject(
      { hasCustomCategories: true },
    );
    await expect(build({ rule: true }).service.getSetupProgress('ws-1')).resolves.toMatchObject({
      hasCustomCategories: true,
    });
  });

  it('reports budgets and goals', async () => {
    await expect(
      build({ budget: true, goal: true }).service.getSetupProgress('ws-1'),
    ).resolves.toMatchObject({ hasBudget: true, hasGoal: true });
  });

  it('scopes every lookup to the workspace and skips deleted statements and system categories', async () => {
    const { service, repos } = build({});
    await service.getSetupProgress('ws-7');
    for (const r of Object.values(repos)) {
      expect(r.exists).toHaveBeenCalledWith({
        where: expect.objectContaining({ workspaceId: 'ws-7' }),
      });
    }
    expect(repos.statement.exists).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-7', deletedAt: IsNull() },
    });
    expect(repos.category.exists).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-7', source: CategorySource.USER },
    });
  });
});
