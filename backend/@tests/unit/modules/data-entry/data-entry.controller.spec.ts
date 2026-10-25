import { DataEntryType } from '@/entities/data-entry.entity';
import { DataEntryController } from '@/modules/data-entry/data-entry.controller';
import { BadRequestException } from '@nestjs/common';

describe('DataEntryController', () => {
  it('list clamps limit/page and returns paging metadata', async () => {
    const dataEntryService = {
      create: vi.fn(),
      list: vi.fn(async () => ({ items: [{ id: 'e1' }], total: 1 })),
      remove: vi.fn(),
      listCustomFields: vi.fn(async () => []),
      getHiddenBaseTabs: vi.fn(async () => [DataEntryType.CASH]),
      removeBaseTab: vi.fn(),
      createCustomField: vi.fn(),
      updateCustomField: vi.fn(),
      removeCustomField: vi.fn(),
    };
    const controller = new DataEntryController(dataEntryService as any, {} as any);
    const workspaceId = 'ws-1';

    const result = await controller.list(
      { id: 'u1' } as any,
      workspaceId,
      { type: 'credit', limit: 9999, page: -10, q: 'q', date: '2025-01-01' },
    );

    expect(result).toEqual({
      items: [{ id: 'e1' }],
      total: 1,
      page: 1,
      limit: 200,
    });
    expect(dataEntryService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        limit: 200,
        page: 1,
        type: DataEntryType.CREDIT,
      }),
    );
  });

  it('forwards workspaceId to mutating actions', async () => {
    const dataEntryService = {
      create: vi.fn(async () => ({ id: 'e1' })),
      remove: vi.fn(async () => undefined),
      listCustomFields: vi.fn(async () => []),
      getHiddenBaseTabs: vi.fn(async () => []),
      removeBaseTab: vi.fn(async () => undefined),
      createCustomField: vi.fn(async () => ({ id: 'f1' })),
      updateCustomField: vi.fn(async () => ({ id: 'f1' })),
      removeCustomField: vi.fn(async () => undefined),
    };
    const controller = new DataEntryController(dataEntryService as any, {} as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'ws-1';

    await controller.create(user, workspaceId, { type: DataEntryType.CASH } as any);
    await controller.remove(user, workspaceId, { id: 'e1' });
    await controller.listCustomFields(user, workspaceId);
    await controller.removeBaseTab(user, workspaceId, { type: 'cash' });
    await controller.createCustomField(user, workspaceId, { name: 'Field' } as any);
    await controller.updateCustomField(user, workspaceId, { id: 'f1' }, { name: 'Renamed' } as any);
    await controller.removeCustomField(user, workspaceId, { id: 'f1' });

    expect(dataEntryService.create).toHaveBeenCalledWith(workspaceId, user.id, {
      type: DataEntryType.CASH,
    });
    expect(dataEntryService.remove).toHaveBeenCalledWith(workspaceId, user.id, 'e1');
    expect(dataEntryService.listCustomFields).toHaveBeenCalledWith(workspaceId);
    expect(dataEntryService.getHiddenBaseTabs).toHaveBeenCalledWith(user.id);
    expect(dataEntryService.removeBaseTab).toHaveBeenCalledWith(
      workspaceId,
      user.id,
      DataEntryType.CASH,
    );
    expect(dataEntryService.createCustomField).toHaveBeenCalledWith(workspaceId, user.id, {
      name: 'Field',
    });
    expect(dataEntryService.updateCustomField).toHaveBeenCalledWith(workspaceId, user.id, 'f1', {
      name: 'Renamed',
    });
    expect(dataEntryService.removeCustomField).toHaveBeenCalledWith(workspaceId, user.id, 'f1');
  });

  it('returns cached response for a repeated idempotency key without creating a duplicate', async () => {
    const dataEntryService = {
      create: vi.fn(async () => ({ id: 'e1' })),
    };
    const idempotencyService = {
      checkKey: vi.fn(async () => null),
      storeKey: vi.fn(async () => undefined),
    };
    const controller = new DataEntryController(
      dataEntryService as any,
      idempotencyService as any,
    );
    const user = { id: 'u1' } as any;
    const workspaceId = 'ws-1';
    const dto = { type: DataEntryType.CASH } as any;

    const first = await controller.create(user, workspaceId, dto, 'key-1');
    expect(first).toEqual({ id: 'e1' });
    expect(idempotencyService.checkKey).toHaveBeenCalledWith('key-1', 'u1', 'ws-1');
    expect(idempotencyService.storeKey).toHaveBeenCalledWith('key-1', 'u1', 'ws-1', { id: 'e1' });

    idempotencyService.checkKey.mockResolvedValueOnce({ data: { id: 'e1' }, cached: true } as any);
    const second = await controller.create(user, workspaceId, dto, 'key-1');
    expect(second).toEqual({ id: 'e1' });
    expect(dataEntryService.create).toHaveBeenCalledTimes(1);
  });

  it('skips idempotency machinery when no key is provided', async () => {
    const dataEntryService = {
      create: vi.fn(async () => ({ id: 'e1' })),
    };
    const idempotencyService = {
      checkKey: vi.fn(),
      storeKey: vi.fn(),
    };
    const controller = new DataEntryController(
      dataEntryService as any,
      idempotencyService as any,
    );

    await controller.create({ id: 'u1' } as any, 'ws-1', { type: DataEntryType.CASH } as any);

    expect(idempotencyService.checkKey).not.toHaveBeenCalled();
    expect(idempotencyService.storeKey).not.toHaveBeenCalled();
  });

  it('uploadCustomIcon throws when file is missing', async () => {
    const controller = new DataEntryController({} as any, {} as any);
    await expect(controller.uploadCustomIcon(undefined as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('uploadCustomIcon returns url for uploaded file', async () => {
    const controller = new DataEntryController({} as any, {} as any);
    const res = await controller.uploadCustomIcon({
      filename: 'icon.png',
    } as any);
    expect(res.url).toBe('/uploads/custom-field-icons/icon.png');
  });
});
