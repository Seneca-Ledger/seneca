import { IsNull } from 'typeorm';
import { buildStorageCategoryWhere } from '@/modules/storage/storage-category-scope.util';

describe('buildStorageCategoryWhere', () => {
  it('resolves category in current workspace when statement has workspace', () => {
    expect(buildStorageCategoryWhere('cat-1', 'user-1', 'ws-1')).toEqual([
      {
        id: 'cat-1',
        workspaceId: 'ws-1',
      },
    ]);
  });

  it('falls back to legacy user and global categories outside workspace', () => {
    expect(buildStorageCategoryWhere('cat-1', 'user-1', null)).toEqual([
      {
        id: 'cat-1',
        userId: 'user-1',
      },
      {
        id: 'cat-1',
        userId: IsNull(),
        workspaceId: IsNull(),
      },
    ]);
  });
});
