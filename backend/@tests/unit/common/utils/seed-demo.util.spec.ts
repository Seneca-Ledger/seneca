import { CategorySource, CategoryType, UserRole, WorkspaceRole } from '@/entities';
import {
  DEMO_EMAIL,
  DEMO_NAME,
  seedDemoData,
} from '@/common/utils/seed-demo.util';

function createRepoMock<T>() {
  return {
    findOne: vi.fn(),
    create: vi.fn((data: Partial<T>) => data as T),
    save: vi.fn(async (data: Partial<T>) => ({ ...data }) as T),
    update: vi.fn(async () => ({ affected: 1 })),
    count: vi.fn(async () => 0),
  };
}

describe('seedDemoData', () => {
  it('creates the demo user, workspace, membership, and default records', async () => {
    const userRepository = createRepoMock<any>();
    const workspaceRepository = createRepoMock<any>();
    const workspaceMemberRepository = createRepoMock<any>();
    const categoryRepository = createRepoMock<any>();
    const taxRateRepository = createRepoMock<any>();
    const balanceAccountRepository = createRepoMock<any>();

    userRepository.findOne.mockResolvedValueOnce(null);
    userRepository.save.mockResolvedValueOnce({
      id: 'user-1',
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      role: UserRole.USER,
      workspaceId: null,
      isActive: true,
    });
    workspaceRepository.findOne.mockResolvedValue(null);
    workspaceRepository.save.mockResolvedValueOnce({
      id: 'workspace-1',
      name: `${DEMO_NAME} workspace`,
      ownerId: 'user-1',
    });
    workspaceMemberRepository.findOne.mockResolvedValue(null);
    categoryRepository.findOne.mockResolvedValue(null);
    taxRateRepository.count.mockResolvedValue(0);
    balanceAccountRepository.count.mockResolvedValue(0);

    await seedDemoData({
      userRepository: userRepository as any,
      workspaceRepository: workspaceRepository as any,
      workspaceMemberRepository: workspaceMemberRepository as any,
      categoryRepository: categoryRepository as any,
      taxRateRepository: taxRateRepository as any,
      balanceAccountRepository: balanceAccountRepository as any,
      hashPassword: async () => 'hashed-demo-password',
    });

    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: DEMO_EMAIL,
        name: DEMO_NAME,
        passwordHash: 'hashed-demo-password',
        role: UserRole.USER,
        isActive: true,
      }),
    );
    expect(workspaceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'user-1' }),
    );
    expect(workspaceMemberRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: WorkspaceRole.OWNER,
        invitedById: 'user-1',
      }),
    );
    expect(userRepository.update).toHaveBeenCalledWith('user-1', {
      workspaceId: 'workspace-1',
      lastWorkspaceId: 'workspace-1',
    });
    expect(categoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        name: 'Продажи',
        type: CategoryType.INCOME,
        isSystem: true,
        source: CategorySource.SYSTEM,
        isEnabled: true,
      }),
    );
    expect(taxRateRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        name: 'Tax exempt (0%)',
        rate: 0,
        isDefault: true,
        isEnabled: true,
      }),
    );
    expect(balanceAccountRepository.save).toHaveBeenCalled();
  });
});
