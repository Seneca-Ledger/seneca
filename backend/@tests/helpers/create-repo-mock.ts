import type { Mock } from 'vitest';
import type { Repository } from 'typeorm';

type MockRepository<T> = {
  [K in keyof Repository<T>]: K extends
    | 'find'
    | 'findOne'
    | 'findAndCount'
    | 'findOneBy'
    | 'findBy'
    | 'create'
    | 'save'
    | 'remove'
    | 'delete'
    | 'update'
    | 'count'
    | 'createQueryBuilder'
    | 'merge'
    | 'preload'
    | 'softRemove'
    | 'softDelete'
    ? Mock
    : Repository<T>[K];
};

/**
 * Creates a mock TypeORM Repository with common methods stubbed as vi.fn().
 * Use this instead of manually creating mock objects in each test file.
 */
export function createRepoMock<T = any>(): MockRepository<T> {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    findAndCount: vi.fn(),
    findOneBy: vi.fn(),
    findBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    createQueryBuilder: vi.fn(),
    merge: vi.fn(),
    preload: vi.fn(),
    softRemove: vi.fn(),
    softDelete: vi.fn(),
  } as unknown as MockRepository<T>;
}
