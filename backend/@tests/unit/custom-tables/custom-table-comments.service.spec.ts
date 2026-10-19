import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomTableCommentsService } from '../../../src/modules/custom-tables/custom-table-comments.service';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(async (v: unknown) => ({ id: 'c1', createdAt: new Date(), ...(v as object) })),
  create: jest.fn((v?: unknown) => v),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const TABLE_ID = '11111111-1111-4111-8111-111111111111';
const ROW_ID = '22222222-2222-4222-8222-222222222222';

function buildService(options: { tableFound?: boolean; rowFound?: boolean } = {}) {
  const commentRepository = createRepositoryMock();
  const tableRepository = createRepositoryMock();
  const rowRepository = createRepositoryMock();
  const workspaceMemberRepository = createRepositoryMock();

  tableRepository.createQueryBuilder.mockReturnValue({
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest
      .fn()
      .mockResolvedValue(options.tableFound === false ? null : { id: TABLE_ID }),
  });
  rowRepository.findOne.mockResolvedValue(
    options.rowFound === false ? null : { id: ROW_ID, tableId: TABLE_ID },
  );
  commentRepository.findOne.mockResolvedValue({
    id: 'c1',
    body: 'текст',
    resolvedAt: null,
    createdAt: new Date(),
    user: { id: 'u1', name: 'Пётр', email: 'p@example.com' },
  });

  const service = new CustomTableCommentsService(
    commentRepository as never,
    tableRepository as never,
    rowRepository as never,
    workspaceMemberRepository as never,
  );

  return { service, commentRepository, workspaceMemberRepository };
}

describe('CustomTableCommentsService', () => {
  it('refuses mutations for a member without edit permission', async () => {
    const { service, workspaceMemberRepository } = buildService();
    workspaceMemberRepository.findOne.mockResolvedValue({
      role: 'member',
      permissions: { canEditCustomTables: false },
    });

    await expect(
      service.addComment('u1', 'ws-1', TABLE_ID, ROW_ID, 'привет'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.setResolved('u1', 'ws-1', 'c1', true)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.deleteComment('u1', 'ws-1', 'c1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an empty comment', async () => {
    const { service } = buildService();

    await expect(
      service.addComment('u1', 'ws-1', TABLE_ID, ROW_ID, '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an over-long comment', async () => {
    const { service } = buildService();

    await expect(
      service.addComment('u1', 'ws-1', TABLE_ID, ROW_ID, 'x'.repeat(4001)),
    ).rejects.toMatchObject({ response: { code: 'COMMENT_TOO_LONG' } });
  });

  it('refuses to comment on a table from another workspace', async () => {
    const { service } = buildService({ tableFound: false });

    await expect(
      service.addComment('u1', 'ws-1', TABLE_ID, ROW_ID, 'привет'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to comment on a row that is not in the table', async () => {
    const { service } = buildService({ rowFound: false });

    await expect(
      service.addComment('u1', 'ws-1', TABLE_ID, ROW_ID, 'привет'),
    ).rejects.toMatchObject({ response: { code: 'ROW_NOT_FOUND' } });
  });

  it('falls back to email when the author has no name', async () => {
    const { service, commentRepository } = buildService();
    commentRepository.findOne.mockResolvedValue({
      id: 'c1',
      body: 'x',
      resolvedAt: null,
      createdAt: new Date(),
      user: { id: 'u1', name: '', email: 'p@example.com' },
    });

    const result = await service.addComment('u1', 'ws-1', TABLE_ID, ROW_ID, 'x');

    expect(result.author?.name).toBe('p@example.com');
  });

  it('keeps a comment whose author was deleted', async () => {
    const { service, commentRepository } = buildService();
    commentRepository.find.mockResolvedValue([
      { id: 'c1', body: 'остался', resolvedAt: null, createdAt: new Date(), user: null },
    ]);

    const items = await service.listComments('ws-1', TABLE_ID, ROW_ID);

    expect(items[0].body).toBe('остался');
    expect(items[0].author).toBeNull();
  });

  it('counts only open comments per row', async () => {
    const { service, commentRepository } = buildService();
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ row_id: ROW_ID, cnt: '3' }]),
    };
    commentRepository.createQueryBuilder.mockReturnValue(qb);

    const counts = await service.countOpenByRow('ws-1', TABLE_ID);

    expect(counts[ROW_ID]).toBe(3);
    // Решённые обсуждения не должны подсвечивать строку.
    expect(qb.andWhere).toHaveBeenCalledWith('c.resolvedAt IS NULL');
  });
});
