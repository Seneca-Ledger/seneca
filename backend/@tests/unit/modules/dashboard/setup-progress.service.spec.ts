import { IsNull } from 'typeorm';
import { CategorySource } from '@/entities/category.entity';
import { SetupProgressService } from '@/modules/dashboard/setup-progress.service';

function repo(found: boolean) {
  return { exists: vi.fn(async () => found) };
}

const user = { id: 'user-1', workspaceId: 'ws-home', telegramChatId: null, telegramWorkspaceId: null } as any;

function build(
  found: Partial<Record<'statement' | 'receipt' | 'category' | 'rule' | 'budget' | 'goal' | 'wallet', boolean>>,
  botToken: string | null = null,
) {
  const repos = {
    statement: repo(found.statement ?? false),
    receipt: repo(found.receipt ?? false),
    category: repo(found.category ?? false),
    rule: repo(found.rule ?? false),
    budget: repo(found.budget ?? false),
    goal: repo(found.goal ?? false),
    wallet: repo(found.wallet ?? false),
  };
  const service = new SetupProgressService(
    repos.statement as any,
    repos.receipt as any,
    repos.category as any,
    repos.rule as any,
    repos.budget as any,
    repos.goal as any,
    repos.wallet as any,
    { getTelegramSettings: vi.fn(async () => ({ botToken })) } as any,
  );
  return { service, repos };
}

describe('SetupProgressService', () => {
  it('reports nothing done for an empty workspace', async () => {
    const { service } = build({});
    await expect(service.getSetupProgress('ws-1', user)).resolves.toEqual({
      hasUpload: false,
      hasWallet: false,
      hasCustomCategories: false,
      hasBudget: false,
      hasGoal: false,
      telegramAvailable: false,
      hasTelegram: false,
    });
  });

  it('counts a receipt alone as an upload', async () => {
    const { service } = build({ receipt: true });
    await expect(service.getSetupProgress('ws-1', user)).resolves.toMatchObject({ hasUpload: true });
  });

  it('counts a statement as an upload', async () => {
    const { service } = build({ statement: true });
    await expect(service.getSetupProgress('ws-1', user)).resolves.toMatchObject({ hasUpload: true });
  });

  it('counts either a user category or a rule as customized categories', async () => {
    await expect(build({ category: true }).service.getSetupProgress('ws-1', user)).resolves.toMatchObject(
      { hasCustomCategories: true },
    );
    await expect(build({ rule: true }).service.getSetupProgress('ws-1', user)).resolves.toMatchObject({
      hasCustomCategories: true,
    });
  });

  it('counts an active account', async () => {
    const { service, repos } = build({ wallet: true });
    await expect(service.getSetupProgress('ws-1', user)).resolves.toMatchObject({ hasWallet: true });
    expect(repos.wallet.exists).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1', isActive: true },
    });
  });

  it('reports budgets and goals', async () => {
    await expect(
      build({ budget: true, goal: true }).service.getSetupProgress('ws-1', user),
    ).resolves.toMatchObject({ hasBudget: true, hasGoal: true });
  });

  it('scopes every lookup to the workspace and skips deleted statements and system categories', async () => {
    const { service, repos } = build({});
    await service.getSetupProgress('ws-7', user);
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

  it('offers the Telegram step once a bot serves the workspace', async () => {
    await expect(build({}, '1:bot').service.getSetupProgress('ws-1', user)).resolves.toMatchObject({
      telegramAvailable: true,
      hasTelegram: false,
    });
  });

  it('ticks Telegram off only for a chat connected to this workspace', async () => {
    const connected = { ...user, telegramChatId: 'chat-1', telegramWorkspaceId: 'ws-1' };
    const { service } = build({}, '1:bot');

    await expect(service.getSetupProgress('ws-1', connected)).resolves.toMatchObject({ hasTelegram: true });
    await expect(service.getSetupProgress('ws-2', connected)).resolves.toMatchObject({ hasTelegram: false });
  });
});
