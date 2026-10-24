import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Folder } from '@/entities/folder.entity';
import { Tag } from '@/entities/tag.entity';
import { TagsService } from '@/modules/tags/tags.service';

const storedTag = (overrides: Partial<Tag> = {}): Tag =>
  ({
    id: 'tag-1',
    name: 'Trip',
    color: '#ff0000',
    description: null,
    tagDate: null,
    userId: null,
    workspaceId: 'ws-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Tag;

function build() {
  const folderRepo = { update: jest.fn().mockResolvedValue(undefined) };
  const txTagRepo = { delete: jest.fn().mockResolvedValue(undefined) };
  const manager = {
    getRepository: jest.fn((entity: unknown) => (entity === Folder ? folderRepo : txTagRepo)),
  };
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value: Partial<Tag>) => value as Tag),
    save: jest.fn(async (value: Tag) => ({ id: 'tag-new', ...value })),
    query: jest.fn(),
    manager: {
      transaction: jest.fn(async (work: (m: typeof manager) => Promise<void>) => work(manager)),
    },
  };
  return { service: new TagsService(repo as never), repo, folderRepo, txTagRepo };
}

describe('TagsService', () => {
  it('lists the workspace tags by name without workspace bookkeeping', async () => {
    const { service, repo } = build();
    repo.find.mockResolvedValue([storedTag({ description: 'Summer', tagDate: '2026-07-01' })]);

    await expect(service.list('ws-1')).resolves.toEqual([
      { id: 'tag-1', name: 'Trip', color: '#ff0000', description: 'Summer', tagDate: '2026-07-01' },
    ]);
    expect(repo.find).toHaveBeenCalledWith({ where: { workspaceId: 'ws-1' }, order: { name: 'ASC' } });
  });

  it('adds statement, receipt and transaction usage per tag, zero when unused', async () => {
    const { service, repo } = build();
    repo.find.mockResolvedValue([storedTag(), storedTag({ id: 'tag-2', name: 'Work' })]);
    repo.query.mockResolvedValue([{ tagId: 'tag-1', count: '7' }]);

    const list = await service.listWithUsage('ws-1');

    expect(list.map(tag => [tag.id, tag.usageCount])).toEqual([
      ['tag-1', 7],
      ['tag-2', 0],
    ]);
    const [sql, params] = repo.query.mock.calls[0];
    expect(sql).toContain('statement_tags');
    expect(sql).toContain('receipt_tags');
    expect(sql).toContain('transaction_tags');
    expect(params).toEqual(['ws-1']);
  });

  it('creates a tag in the workspace with a trimmed name and description', async () => {
    const { service, repo } = build();

    const view = await service.create(
      { name: '  Trip  ', description: '  Lisbon  ', tagDate: '2026-07-01' } as never,
      'ws-1',
    );

    expect(repo.create).toHaveBeenCalledWith({
      name: 'Trip',
      color: null,
      description: 'Lisbon',
      tagDate: '2026-07-01',
      workspaceId: 'ws-1',
    });
    expect(view).toEqual({
      id: 'tag-new',
      name: 'Trip',
      color: null,
      description: 'Lisbon',
      tagDate: '2026-07-01',
    });
    expect(view).not.toHaveProperty('workspaceId');
  });

  it('refuses a blank name', async () => {
    const { service, repo } = build();
    await expect(service.create({ name: '   ' } as never, 'ws-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('stores a whitespace-only description as none', async () => {
    const { service, repo } = build();
    await service.create({ name: 'Trip', description: '   ' } as never, 'ws-1');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
  });

  it('updates only the fields sent; null clears the optional ones but never the name', async () => {
    const { service, repo } = build();
    repo.findOne.mockResolvedValue(
      storedTag({ description: 'Old', tagDate: '2026-01-01', color: '#000000' }),
    );

    const view = await service.update(
      'tag-1',
      { name: null, description: null, tagDate: '2026-02-02' } as never,
      'ws-1',
    );

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'tag-1', workspaceId: 'ws-1' } });
    expect(view).toEqual(
      expect.objectContaining({
        name: 'Trip',
        color: '#000000',
        description: null,
        tagDate: '2026-02-02',
      }),
    );
  });

  it('cannot update or delete a tag of another workspace', async () => {
    const { service, repo } = build();
    repo.findOne.mockResolvedValue(null);

    await expect(service.update('tag-1', { name: 'X' } as never, 'ws-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove('tag-1', 'ws-2')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.manager.transaction).not.toHaveBeenCalled();
  });

  it('deletes the tag and unfiles folders under it, inside the workspace, in one transaction', async () => {
    const { service, repo, folderRepo, txTagRepo } = build();
    repo.findOne.mockResolvedValue(storedTag());

    await service.remove('tag-1', 'ws-1');

    expect(repo.manager.transaction).toHaveBeenCalledTimes(1);
    expect(folderRepo.update).toHaveBeenCalledWith(
      { tagId: 'tag-1', workspaceId: 'ws-1' },
      { tagId: null },
    );
    expect(txTagRepo.delete).toHaveBeenCalledWith({ id: 'tag-1', workspaceId: 'ws-1' });
  });
});
