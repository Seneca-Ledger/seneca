import { StorageController } from '@/modules/storage/storage.controller';

describe('StorageController', () => {
  it('forwards workspaceId for tags and views', async () => {
    // The /storage/tags routes stay for old clients; the tags live in TagsService.
    const tagsService = {
      create: jest.fn(async () => ({ id: 'tag-1' })),
      list: jest.fn(async () => [{ id: 'tag-1' }]),
      update: jest.fn(async () => ({ id: 'tag-1', name: 'Updated' })),
      remove: jest.fn(async () => undefined),
    };
    const storageService = {
      createView: jest.fn(async () => ({ id: 'view-1' })),
      listViews: jest.fn(async () => [{ id: 'view-1' }]),
      deleteView: jest.fn(async () => ({ deleted: true })),
    };
    const controller = new StorageController(storageService as any, tagsService as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'ws-1';

    expect(await controller.createTag({ name: 'A' } as any, user, workspaceId)).toEqual({
      id: 'tag-1',
    });
    expect(await controller.listTags(user, workspaceId)).toEqual([{ id: 'tag-1' }]);
    expect(
      await controller.updateTag('tag-1', { name: 'Updated' } as any, user, workspaceId),
    ).toEqual({
      id: 'tag-1',
      name: 'Updated',
    });
    expect(await controller.deleteTag('tag-1', user, workspaceId)).toEqual({
      message: 'Tag deleted successfully',
    });
    expect(await controller.createView({ name: 'View' } as any, user, workspaceId)).toEqual({
      id: 'view-1',
    });
    expect(await controller.listViews(user, workspaceId)).toEqual([{ id: 'view-1' }]);
    expect(await controller.deleteView('view-1', user, workspaceId)).toEqual({ deleted: true });

    expect(tagsService.create).toHaveBeenCalledWith({ name: 'A' }, workspaceId);
    expect(tagsService.list).toHaveBeenCalledWith(workspaceId);
    expect(tagsService.update).toHaveBeenCalledWith(
      'tag-1',
      { name: 'Updated' },
      workspaceId,
    );
    expect(tagsService.remove).toHaveBeenCalledWith('tag-1', workspaceId);
    expect(storageService.createView).toHaveBeenCalledWith({ name: 'View' }, 'u1', workspaceId);
    expect(storageService.listViews).toHaveBeenCalledWith(workspaceId);
    expect(storageService.deleteView).toHaveBeenCalledWith('view-1', workspaceId);
  });
});
