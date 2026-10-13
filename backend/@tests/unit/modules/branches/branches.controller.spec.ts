import { BranchesController } from '@/modules/branches/branches.controller';

describe('BranchesController', () => {
  it('proxies calls to BranchesService with workspaceId', async () => {
    const branchesService = {
      create: jest.fn(async () => ({ id: 'b1' })),
      findAll: jest.fn(async () => [{ id: 'b1' }]),
      findOne: jest.fn(async () => ({ id: 'b1' })),
      update: jest.fn(async () => ({ id: 'b1', name: 'X' })),
      remove: jest.fn(async () => undefined),
    };
    const controller = new BranchesController(branchesService as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'ws-1';

    expect(await controller.create({ name: 'A' } as any, user, workspaceId)).toEqual({ id: 'b1' });
    expect(await controller.findAll(user, workspaceId)).toEqual([{ id: 'b1' }]);
    expect(await controller.findOne('b1', user, workspaceId)).toEqual({ id: 'b1' });
    expect(await controller.update('b1', { name: 'X' } as any, user, workspaceId)).toEqual({
      id: 'b1',
      name: 'X',
    });
    expect(await controller.remove('b1', user, workspaceId)).toEqual({
      message: 'Branch deleted successfully',
    });

    expect(branchesService.create).toHaveBeenCalledWith(workspaceId, 'u1', { name: 'A' });
    expect(branchesService.findAll).toHaveBeenCalledWith(workspaceId);
    expect(branchesService.findOne).toHaveBeenCalledWith('b1', workspaceId);
    expect(branchesService.update).toHaveBeenCalledWith('b1', workspaceId, { name: 'X' });
    expect(branchesService.remove).toHaveBeenCalledWith('b1', workspaceId);
  });
});
