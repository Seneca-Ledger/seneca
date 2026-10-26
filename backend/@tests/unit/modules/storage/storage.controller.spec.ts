import { StorageController } from '@/modules/storage/storage.controller';

describe('StorageController', () => {
  it('forwards workspaceId for tags and views', async () => {
    const storageService = {
      createTag: vi.fn(async () => ({ id: 'tag-1' })),
      listTags: vi.fn(async () => [{ id: 'tag-1' }]),
      updateTag: vi.fn(async () => ({ id: 'tag-1', name: 'Updated' })),
      deleteTag: vi.fn(async () => undefined),
      createView: vi.fn(async () => ({ id: 'view-1' })),
      listViews: vi.fn(async () => [{ id: 'view-1' }]),
      deleteView: vi.fn(async () => ({ deleted: true })),
    };
    const controller = new StorageController(storageService as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'ws-1';

    expect(await controller.createTag({ name: 'A' } as any, user, workspaceId)).toEqual({
      id: 'tag-1',
    });
    expect(await controller.listTags(user, workspaceId)).toEqual([{ id: 'tag-1' }]);
    expect(
      await controller.updateTag({ id: 'tag-1' }, { name: 'Updated' } as any, user, workspaceId),
    ).toEqual({
      id: 'tag-1',
      name: 'Updated',
    });
    expect(await controller.deleteTag({ id: 'tag-1' }, user, workspaceId)).toEqual({
      message: 'Tag deleted successfully',
    });
    expect(await controller.createView({ name: 'View' } as any, user, workspaceId)).toEqual({
      id: 'view-1',
    });
    expect(await controller.listViews(user, workspaceId)).toEqual([{ id: 'view-1' }]);
    expect(await controller.deleteView({ id: 'view-1' }, user, workspaceId)).toEqual({ deleted: true });

    expect(storageService.createTag).toHaveBeenCalledWith({ name: 'A' }, workspaceId);
    expect(storageService.listTags).toHaveBeenCalledWith(workspaceId);
    expect(storageService.updateTag).toHaveBeenCalledWith(
      'tag-1',
      { name: 'Updated' },
      workspaceId,
    );
    expect(storageService.deleteTag).toHaveBeenCalledWith('tag-1', workspaceId);
    expect(storageService.createView).toHaveBeenCalledWith({ name: 'View' }, 'u1', workspaceId);
    expect(storageService.listViews).toHaveBeenCalledWith(workspaceId);
    expect(storageService.deleteView).toHaveBeenCalledWith('view-1', workspaceId);
  });
});
