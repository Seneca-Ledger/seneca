import type { Repository } from 'typeorm';
import {
  BalanceAccount,
  Category,
  CategorySource,
  CategoryType,
  TaxRate,
  User,
  UserRole,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '@/entities';
import { DEFAULT_BALANCE_ACCOUNTS } from '@/modules/balance/balance-default-accounts';
import { currencyCodeOrDefault } from './currency.util';

export const DEMO_EMAIL = 'demo@lumio.dev';
export const DEMO_PASSWORD = 'demo123';
export const DEMO_NAME = 'Demo User';

const DEFAULT_SYSTEM_CATEGORIES: ReadonlyArray<{
  name: string;
  type: CategoryType;
}> = [
  { name: 'Продажи', type: CategoryType.INCOME },
  { name: 'Услуги', type: CategoryType.INCOME },
  { name: 'Процентный доход', type: CategoryType.INCOME },
  { name: 'Прочий доход', type: CategoryType.INCOME },
  { name: 'Реклама', type: CategoryType.EXPENSE },
  { name: 'Льготы и компенсации', type: CategoryType.EXPENSE },
  { name: 'Автомобильные расходы', type: CategoryType.EXPENSE },
  { name: 'Оборудование', type: CategoryType.EXPENSE },
  { name: 'Комиссии и сборы', type: CategoryType.EXPENSE },
  { name: 'Домашний офис', type: CategoryType.EXPENSE },
  { name: 'Страхование', type: CategoryType.EXPENSE },
  { name: 'Проценты', type: CategoryType.EXPENSE },
  { name: 'Оплата труда', type: CategoryType.EXPENSE },
  { name: 'Обслуживание и ремонт', type: CategoryType.EXPENSE },
  { name: 'Материалы', type: CategoryType.EXPENSE },
  { name: 'Питание и представительские расходы', type: CategoryType.EXPENSE },
  { name: 'Канцелярские товары', type: CategoryType.EXPENSE },
  { name: 'Прочие расходы', type: CategoryType.EXPENSE },
  { name: 'Профессиональные услуги', type: CategoryType.EXPENSE },
  { name: 'Аренда', type: CategoryType.EXPENSE },
  { name: 'Налоги', type: CategoryType.EXPENSE },
  { name: 'Командировки', type: CategoryType.EXPENSE },
  { name: 'Коммунальные услуги', type: CategoryType.EXPENSE },
];

type SeedDemoDataParams = {
  userRepository: Repository<User>;
  workspaceRepository: Repository<Workspace>;
  workspaceMemberRepository: Repository<WorkspaceMember>;
  categoryRepository: Repository<Category>;
  taxRateRepository: Repository<TaxRate>;
  balanceAccountRepository: Repository<BalanceAccount>;
  hashPassword: (password: string) => Promise<string>;
};

export async function seedDemoData({
  userRepository,
  workspaceRepository,
  workspaceMemberRepository,
  categoryRepository,
  taxRateRepository,
  balanceAccountRepository,
  hashPassword,
}: SeedDemoDataParams): Promise<User> {
  let user = await userRepository.findOne({
    where: { email: DEMO_EMAIL },
    select: ['id', 'email', 'name', 'role', 'workspaceId', 'isActive'],
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  if (!user) {
    user = await userRepository.save(
      userRepository.create({
        email: DEMO_EMAIL,
        passwordHash,
        name: DEMO_NAME,
        role: UserRole.USER,
        isActive: true,
      }),
    );
  } else {
    await userRepository.update(user.id, {
      passwordHash,
      isActive: true,
      name: user.name || DEMO_NAME,
    });
    user = {
      ...user,
      passwordHash,
      isActive: true,
      name: user.name || DEMO_NAME,
    } as User;
  }

  let workspace = user.workspaceId
    ? await workspaceRepository.findOne({ where: { id: user.workspaceId } })
    : null;

  if (!workspace) {
    workspace = await workspaceRepository.save(
      workspaceRepository.create({
        name: `${user.name || user.email} workspace`,
        ownerId: user.id,
        currency: currencyCodeOrDefault(null),
      }),
    );

    const membership = await workspaceMemberRepository.findOne({
      where: { workspaceId: workspace.id, userId: user.id },
      select: ['id'],
    });

    if (!membership) {
      await workspaceMemberRepository.save(
        workspaceMemberRepository.create({
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceRole.OWNER,
          invitedById: user.id,
        }),
      );
    }

    await userRepository.update(user.id, {
      workspaceId: workspace.id,
      lastWorkspaceId: workspace.id,
    });
    user.workspaceId = workspace.id;
    user.lastWorkspaceId = workspace.id;
  }

  for (const categoryData of DEFAULT_SYSTEM_CATEGORIES) {
    const existingCategory = await categoryRepository.findOne({
      where: { workspaceId: workspace.id, name: categoryData.name },
      select: ['id'],
    });

    if (!existingCategory) {
      await categoryRepository.save(
        categoryRepository.create({
          workspaceId: workspace.id,
          userId: user.id,
          isSystem: true,
          source: CategorySource.SYSTEM,
          isEnabled: true,
          ...categoryData,
        }),
      );
    }
  }

  const existingTaxRates = await taxRateRepository.count({ where: { workspaceId: workspace.id } });
  if (existingTaxRates === 0) {
    await taxRateRepository.save(
      taxRateRepository.create({
        workspaceId: workspace.id,
        name: 'Tax exempt (0%)',
        rate: 0,
        isDefault: true,
        isEnabled: true,
      }),
    );
  }

  const existingBalanceAccounts = await balanceAccountRepository.count({
    where: { workspaceId: workspace.id },
  });
  if (existingBalanceAccounts === 0) {
    const parentByCode = new Map<string, BalanceAccount>();

    for (const definition of DEFAULT_BALANCE_ACCOUNTS) {
      const account = await balanceAccountRepository.save(
        balanceAccountRepository.create({
          workspaceId: workspace.id,
          parentId: definition.parentCode
            ? (parentByCode.get(definition.parentCode)?.id ?? null)
            : null,
          code: definition.code,
          name: definition.name,
          nameEn: definition.nameEn,
          nameKk: definition.nameKk,
          accountType: definition.accountType,
          subType: definition.subType,
          isEditable: definition.isEditable ?? true,
          isAutoComputed: definition.isAutoComputed ?? false,
          autoSource: definition.autoSource ?? null,
          position: definition.position,
          isSystem: true,
          isExpandable: definition.isExpandable ?? false,
        }),
      );

      parentByCode.set(definition.code, account);
    }
  }

  return user;
}
