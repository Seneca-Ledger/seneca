import { BranchesController } from '@/modules/branches/branches.controller';

describe('BranchesController', () => {
  it('proxies calls to BranchesService with workspaceId', async () => {
    const branchesService = {
      create: vi.fn(async () => ({ id: 'b1' })),
      findAll: vi.fn(async () => [{ id: 'b1' }]),
      findOne: vi.fn(async () => ({ id: 'b1' })),
      update: vi.fn(async () => ({ id: 'b1', name: 'X' })),
      remove: vi.fn(async () => undefined),
    };
    const controller = new BranchesController(branchesService as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'ws-1';

    expect(await controller.create({ name: 'A' } as any, user, workspaceId)).toEqual({ id: 'b1' });
    expect(await controller.findAll(user, workspaceId)).toEqual([{ id: 'b1' }]);
    expect(await controller.findOne({ id: 'b1' }, user, workspaceId)).toEqual({ id: 'b1' });
    expect(await controller.update({ id: 'b1' }, { name: 'X' } as any, user, workspaceId)).toEqual({
      id: 'b1',
    }); // read back as stored, not the saved entity
    expect(await controller.remove({ id: 'b1' }, user, workspaceId)).toEqual({
      message: 'Branch deleted successfully',
    });

    expect(branchesService.create).toHaveBeenCalledWith(workspaceId, 'u1', { name: 'A' });
    expect(branchesService.findAll).toHaveBeenCalledWith(workspaceId);
    expect(branchesService.findOne).toHaveBeenCalledWith('b1', workspaceId);
    expect(branchesService.update).toHaveBeenCalledWith('b1', workspaceId, { name: 'X' });
    expect(branchesService.remove).toHaveBeenCalledWith('b1', workspaceId);
  });
});
