import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NoteEntityType } from '../../../../src/entities/note.entity';
import { NotesService } from '../../../../src/modules/notes/notes.service';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  exists: jest.fn().mockResolvedValue(true),
  count: jest.fn(),
  save: jest.fn(async (v: unknown) => ({ id: 'n1', createdAt: new Date(), ...(v as object) })),
  create: jest.fn((v?: unknown) => v),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const WORKSPACE_ID = 'ws-1';
const STATEMENT_ID = '11111111-1111-4111-8111-111111111111';
const MENTION_ID = '33333333-3333-4333-8333-333333333333';

function buildService() {
  const noteRepository = createRepositoryMock();
  const statementRepository = createRepositoryMock();
  const receiptRepository = createRepositoryMock();
  const workspaceMemberRepository = createRepositoryMock();
  const eventEmitter = { emit: jest.fn() };

  noteRepository.findOne.mockResolvedValue({
    id: 'n1',
    body: 'текст',
    mentionedUserIds: [],
    resolvedAt: null,
    createdAt: new Date(),
    userId: 'u1',
    user: { id: 'u1', name: 'Пётр', email: 'p@example.com' },
  });

  // The targets a note can hang off; these cases only use statements, so the
  // rest just have to exist.
  const absentTarget = { exists: jest.fn(async () => false) };
  const service = new NotesService(
    noteRepository as never,
    statementRepository as never,
    receiptRepository as never,
    absentTarget as never,
    absentTarget as never,
    absentTarget as never,
    absentTarget as never,
    workspaceMemberRepository as never,
    eventEmitter as never,
  );

  return {
    service,
    noteRepository,
    statementRepository,
    receiptRepository,
    workspaceMemberRepository,
    eventEmitter,
  };
}

describe('NotesService', () => {
  it('refuses to attach a note to an object from another workspace', async () => {
    const { service, statementRepository } = buildService();
    statementRepository.exists.mockResolvedValue(false);

    await expect(
      service.createNote('u1', WORKSPACE_ID, NoteEntityType.STATEMENT, STATEMENT_ID, 'привет'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('picks the receipt repository for a receipt note', async () => {
    const { service, receiptRepository, statementRepository, noteRepository } = buildService();
    noteRepository.find.mockResolvedValue([]);

    await service.listNotes(WORKSPACE_ID, NoteEntityType.RECEIPT, STATEMENT_ID);

    expect(receiptRepository.exists).toHaveBeenCalled();
    expect(statementRepository.exists).not.toHaveBeenCalled();
  });

  it('rejects an empty note', async () => {
    const { service } = buildService();

    await expect(
      service.createNote('u1', WORKSPACE_ID, NoteEntityType.STATEMENT, STATEMENT_ID, '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a mention of someone outside the workspace', async () => {
    const { service, workspaceMemberRepository } = buildService();
    workspaceMemberRepository.count.mockResolvedValue(0);

    await expect(
      service.createNote('u1', WORKSPACE_ID, NoteEntityType.STATEMENT, STATEMENT_ID, 'эй @Аня', [
        MENTION_ID,
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('notifies the mentioned members and drops a self-mention', async () => {
    const { service, workspaceMemberRepository, eventEmitter } = buildService();
    workspaceMemberRepository.count.mockResolvedValue(1);

    await service.createNote(
      'u1',
      WORKSPACE_ID,
      NoteEntityType.STATEMENT,
      STATEMENT_ID,
      'посмотри @Аня',
      [MENTION_ID, 'u1'],
    );

    expect(workspaceMemberRepository.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ workspaceId: WORKSPACE_ID }),
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'note.mentioned',
      expect.objectContaining({ mentionedUserIds: [MENTION_ID] }),
    );
  });

  it('stays silent when nobody is mentioned', async () => {
    const { service, eventEmitter } = buildService();

    await service.createNote(
      'u1',
      WORKSPACE_ID,
      NoteEntityType.STATEMENT,
      STATEMENT_ID,
      'просто заметка',
    );

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('lets only the author or a workspace admin delete a note', async () => {
    const { service, workspaceMemberRepository, noteRepository } = buildService();
    workspaceMemberRepository.findOne.mockResolvedValue({ role: 'member' });

    await expect(service.deleteNote('u2', WORKSPACE_ID, 'n1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    workspaceMemberRepository.findOne.mockResolvedValue({ role: 'owner' });
    await service.deleteNote('u2', WORKSPACE_ID, 'n1');
    expect(noteRepository.delete).toHaveBeenCalledWith({ id: 'n1', workspaceId: WORKSPACE_ID });
  });

  it('writes a statement note into the statement column', async () => {
    const { service, noteRepository } = buildService();

    await service.createNote(
      'u1',
      WORKSPACE_ID,
      NoteEntityType.STATEMENT,
      STATEMENT_ID,
      'заметка',
    );

    expect(noteRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ statementId: STATEMENT_ID, receiptId: null }),
    );
  });

  it('scopes the open-note counters to the workspace', async () => {
    const { service, noteRepository } = buildService();
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ entity_id: STATEMENT_ID, cnt: '2' }]),
    };
    noteRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const counts = await service.countOpenByEntity(WORKSPACE_ID, NoteEntityType.STATEMENT, [
      STATEMENT_ID,
    ]);

    expect(counts).toEqual({ [STATEMENT_ID]: 2 });
    expect(queryBuilder.where).toHaveBeenCalledWith('n.workspaceId = :workspaceId', {
      workspaceId: WORKSPACE_ID,
    });
  });
});
