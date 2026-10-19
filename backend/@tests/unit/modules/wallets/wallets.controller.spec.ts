import { WalletsController } from '@/modules/wallets/wallets.controller';

describe('WalletsController', () => {
  it('proxies calls to WalletsService with workspaceId', async () => {
    const walletsService = {
      create: jest.fn(async () => ({ id: 'w1' })),
      findAll: jest.fn(async () => [{ id: 'w1' }]),
      findOne: jest.fn(async () => ({ id: 'w1' })),
      update: jest.fn(async () => ({ id: 'w1', name: 'X' })),
      remove: jest.fn(async () => undefined),
    };
    const controller = new WalletsController(walletsService as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'ws-1';

    expect(await controller.create({ name: 'A' } as any, user, workspaceId)).toEqual({ id: 'w1' });
    expect(await controller.findAll(user, workspaceId)).toEqual([{ id: 'w1' }]);
    expect(await controller.findOne('w1', user, workspaceId)).toEqual({ id: 'w1' });
    expect(await controller.update('w1', { name: 'X' } as any, user, workspaceId)).toEqual({
      id: 'w1',
      name: 'X',
    });
    expect(await controller.remove('w1', user, workspaceId)).toEqual({
      message: 'Wallet deleted successfully',
    });

    expect(walletsService.create).toHaveBeenCalledWith(workspaceId, 'u1', { name: 'A' });
    expect(walletsService.findAll).toHaveBeenCalledWith(workspaceId);
    expect(walletsService.findOne).toHaveBeenCalledWith('w1', workspaceId);
    expect(walletsService.update).toHaveBeenCalledWith('w1', workspaceId, { name: 'X' });
    expect(walletsService.remove).toHaveBeenCalledWith('w1', workspaceId);
  });
});
