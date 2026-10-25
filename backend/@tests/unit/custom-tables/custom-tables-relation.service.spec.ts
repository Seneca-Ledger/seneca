import type { Mock } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CustomTableColumnType } from '../../../src/entities/custom-table-column.entity';
import { CustomTablesService } from '../../../src/modules/custom-tables/custom-tables.service';

const createRepositoryMock = () => ({
  findOne: vi.fn(),
  find: vi.fn(),
  save: vi.fn(async (v: unknown) => v),
  create: vi.fn((value?: unknown) => value),
  delete: vi.fn(),
  update: vi.fn(),
  createQueryBuilder: vi.fn(),
});

const TABLE_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_TABLE_ID = '33333333-3333-4333-8333-333333333333';
const FOREIGN_TABLE_ID = '44444444-4444-4444-8444-444444444444';
const TARGET_ROW_ID = '55555555-5555-4555-8555-555555555555';

interface Harness {
  service: CustomTablesService;
  rowRepo: ReturnType<typeof createRepositoryMock>;
}

function buildService(): Harness {
  const customTableRepository = createRepositoryMock();
  const customTableColumnRepository = createRepositoryMock();
  const customTableRowRepository = createRepositoryMock();
  const workspaceMemberRepository = createRepositoryMock();

  // Таблица-цель из чужого воркспейса не находится — так работает requireTable.
  customTableRepository.createQueryBuilder.mockImplementation(() => {
    let requestedId: string | null = null;
    const qb = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn((_sql: string, params: { tableId?: string }) => {
        requestedId = params?.tableId ?? null;
        return qb;
      }),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn(async () =>
        requestedId === FOREIGN_TABLE_ID ? null : { id: requestedId, name: 'Таблица' },
      ),
    };
    return qb;
  });

  customTableColumnRepository.find.mockResolvedValue([
    { key: 'name', title: 'Название', type: CustomTableColumnType.TEXT },
  ]);
  workspaceMemberRepository.findOne.mockResolvedValue({ role: 'owner', permissions: {} });

  const service = new CustomTablesService(
    customTableRepository as never,
    createRepositoryMock() as never,
    customTableColumnRepository as never,
    customTableRowRepository as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    createRepositoryMock() as never,
    workspaceMemberRepository as never,
    { createEvent: vi.fn(), createBatchEvents: vi.fn() } as never,
  );

  return { service, rowRepo: customTableRowRepository };
}

describe('relation columns', () => {
  it('refuses to link a table from another workspace', async () => {
    const { service } = buildService();

    await expect(
      service.addColumn('u1', 'ws-1', TABLE_ID, {
        title: 'Контрагент',
        type: CustomTableColumnType.RELATION,
        config: { targetTableId: FOREIGN_TABLE_ID },
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires a target table', async () => {
    const { service } = buildService();

    await expect(
      service.addColumn('u1', 'ws-1', TABLE_ID, {
        title: 'Контрагент',
        type: CustomTableColumnType.RELATION,
        config: {},
      } as never),
    ).rejects.toMatchObject({ response: { code: 'COLUMN_RELATION_TARGET_REQUIRED' } });
  });

  it('rejects a display column that does not exist in the target', async () => {
    const { service } = buildService();

    await expect(
      service.addColumn('u1', 'ws-1', TABLE_ID, {
        title: 'Контрагент',
        type: CustomTableColumnType.RELATION,
        config: { targetTableId: TARGET_TABLE_ID, displayColumnKey: 'ghost' },
      } as never),
    ).rejects.toMatchObject({ response: { code: 'COLUMN_DISPLAY_NOT_FOUND' } });
  });

  it('lists options labelled by the display column', async () => {
    const { service, rowRepo } = buildService();
    const columnRepo = (service as unknown as { customTableColumnRepository: { findOne: Mock } })
      .customTableColumnRepository;
    columnRepo.findOne.mockResolvedValue({
      key: 'vendor',
      type: CustomTableColumnType.RELATION,
      config: { targetTableId: TARGET_TABLE_ID, displayColumnKey: 'name' },
    });
    rowRepo.createQueryBuilder.mockReturnValue({
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([
        { id: TARGET_ROW_ID, rowNumber: 1, data: { name: 'Магнум' } },
        { id: 'x', rowNumber: 2, data: { name: '  ' } },
      ]),
    });

    const result = await service.listRelationOptions('ws-1', TABLE_ID, 'vendor');

    expect(result.items[0]).toEqual({ id: TARGET_ROW_ID, label: 'Магнум' });
    // Пустая подпись заменяется номером строки, а не пустотой.
    expect(result.items[1].label).toBe('#2');
  });
});
