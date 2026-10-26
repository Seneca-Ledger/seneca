import { WalletsController } from '@/modules/wallets/wallets.controller';

describe('WalletsController', () => {
  it('proxies calls to WalletsService with workspaceId', async () => {
    const walletsService = {
      create: vi.fn(async () => ({ id: 'w1' })),
      list: vi.fn(async () => [{ id: 'w1' }]),
      findOneWithBalance: vi.fn(async () => ({ id: 'w1' })),
      update: vi.fn(async () => ({ id: 'w1', name: 'X' })),
      remove: vi.fn(async () => undefined),
    };
    const controller = new WalletsController(walletsService as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'ws-1';

    expect(await controller.create({ name: 'A' } as any, user, workspaceId)).toEqual({ id: 'w1' });
    expect(await controller.findAll(user, workspaceId)).toEqual([{ id: 'w1' }]);
    expect(await controller.findOne({ id: 'w1' }, user, workspaceId)).toEqual({ id: 'w1' });
    expect(await controller.update({ id: 'w1' }, { name: 'X' } as any, user, workspaceId)).toEqual({
      id: 'w1',
    }); // read back as stored, not the saved entity
    expect(await controller.remove({ id: 'w1' }, user, workspaceId)).toEqual({
      message: 'Wallet deleted successfully',
    });

    expect(walletsService.create).toHaveBeenCalledWith(workspaceId, 'u1', { name: 'A' });
    expect(walletsService.list).toHaveBeenCalledWith(workspaceId);
    expect(walletsService.findOneWithBalance).toHaveBeenCalledWith('w1', workspaceId);
    expect(walletsService.update).toHaveBeenCalledWith('w1', workspaceId, { name: 'X' });
    expect(walletsService.remove).toHaveBeenCalledWith('w1', workspaceId);
  });
});
