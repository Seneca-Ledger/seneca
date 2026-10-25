import { CustomTablesController } from '@/modules/custom-tables/custom-tables.controller';
import { BadRequestException } from '@nestjs/common';

describe('CustomTablesController', () => {
  it('listRows rejects invalid filters JSON', async () => {
    const controller = new CustomTablesController(
      { listRows: vi.fn() } as any,
      {
        rowsKey: vi.fn(),
        getOrSet: vi.fn(),
      } as any,
    );

    await expect(
      controller.listRows({ id: 'u1' } as any, 'ws-1', 't1', undefined, 10, '{bad'),
    ).rejects.toThrow(BadRequestException);
  });

  it('updateColumnStyle bumps the table cache', async () => {
    const customTablesService = {
      updateColumnStyle: vi.fn(async () => ({ columnKey: 'col_a', style: {} })),
    };
    const customTablesCache = { bumpTable: vi.fn(), bumpRows: vi.fn() };
    const controller = new CustomTablesController(
      customTablesService as any,
      customTablesCache as any,
    );

    const dto = { header: { backgroundColor: '#ff0000' } } as any;
    const result = await controller.updateColumnStyle({ id: 'u1' } as any, 'ws-1', 't1', 'c1', dto);

    expect(customTablesService.updateColumnStyle).toHaveBeenCalledWith('u1', 'ws-1', 't1', 'c1', dto);
    expect(customTablesCache.bumpTable).toHaveBeenCalledWith('ws-1', 't1');
    expect(result).toEqual({ columnKey: 'col_a', style: {} });
  });
});
