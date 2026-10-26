import { StorageController } from '@/modules/storage/storage.controller';
import { StorageTagsController } from '@/modules/storage/storage-tags.controller';

describe('StorageController', () => {
  it('forwards workspaceId for tags and views', async () => {
    // The /storage/tags routes stay for old clients; the tags live in TagsService.
    const tagsService = {
      create: vi.fn(async () => ({ id: 'tag-1' })),
      list: vi.fn(async () => [{ id: 'tag-1' }]),
      update: vi.fn(async () => ({ id: 'tag-1', name: 'Updated' })),
      remove: vi.fn(async () => undefined),
    };
    const storageService = {
      createView: vi.fn(async () => ({ id: 'view-1' })),
      listViews: vi.fn(async () => [{ id: 'view-1' }]),
      deleteView: vi.fn(async () => ({ deleted: true })),
    };
    const controller = new StorageController(storageService as any);
    const tagsController = new StorageTagsController(tagsService as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'ws-1';

    expect(await tagsController.createTag({ name: 'A' } as any, user, workspaceId)).toEqual({
      id: 'tag-1',
    });
    expect(await tagsController.listTags(user, workspaceId)).toEqual([{ id: 'tag-1' }]);
    expect(
      await tagsController.updateTag({ id: 'tag-1' }, { name: 'Updated' } as any, user, workspaceId),
    ).toEqual({
      id: 'tag-1',
      name: 'Updated',
    });
    expect(await tagsController.deleteTag({ id: 'tag-1' }, user, workspaceId)).toEqual({
      message: 'Tag deleted successfully',
    });
    expect(await controller.createView({ name: 'View' } as any, user, workspaceId)).toEqual({
      id: 'view-1',
    });
    expect(await controller.listViews(user, workspaceId)).toEqual([{ id: 'view-1' }]);
    expect(await controller.deleteView({ id: 'view-1' }, user, workspaceId)).toEqual({ deleted: true });

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
