import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { Budget } from '../../entities/budget.entity';
import { Goal } from '../../entities/goal.entity';
import { Invoice } from '../../entities/invoice.entity';
import { Note, NoteEntityType } from '../../entities/note.entity';
import { Receipt } from '../../entities/receipt.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { WorkspaceMember, WorkspaceRole } from '../../entities/workspace-member.entity';
import type { NoteMentionedEvent } from '../notifications/events/notification-events';

export interface NoteView {
  id: string;
  body: string;
  mentionedUserIds: string[];
  resolvedAt: Date | null;
  createdAt: Date;
  author: { id: string; name: string } | null;
}

const MAX_BODY_LENGTH = 4000;

/** Колонки `notes`, в одной из которых лежит цель заметки. */
type NoteTargetColumn =
  | 'statementId'
  | 'receiptId'
  | 'transactionId'
  | 'budgetId'
  | 'goalId'
  | 'invoiceId';

/** Любой репозиторий, у объектов которого есть id и воркспейс. */
type TargetRepository = Repository<{ id: string; workspaceId: string }>;

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly noteRepository: Repository<Note>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Budget)
    private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Куда ложится заметка и где искать её объект — одной таблицей, чтобы новый
   * тип цели был одной строкой, а не ещё одной веткой в трёх местах.
   */
  private get targets(): Record<
    NoteEntityType,
    { column: NoteTargetColumn; repository: Repository<{ id: string; workspaceId: string }> }
  > {
    return {
      [NoteEntityType.STATEMENT]: {
        column: 'statementId',
        repository: this.statementRepository as TargetRepository,
      },
      [NoteEntityType.RECEIPT]: {
        column: 'receiptId',
        repository: this.receiptRepository as TargetRepository,
      },
      [NoteEntityType.TRANSACTION]: {
        column: 'transactionId',
        repository: this.transactionRepository as TargetRepository,
      },
      [NoteEntityType.BUDGET]: {
        column: 'budgetId',
        repository: this.budgetRepository as TargetRepository,
      },
      [NoteEntityType.GOAL]: {
        column: 'goalId',
        repository: this.goalRepository as TargetRepository,
      },
      [NoteEntityType.INVOICE]: {
        column: 'invoiceId',
        repository: this.invoiceRepository as TargetRepository,
      },
    };
  }

  /**
   * Внешний ключ не пускает заметку к несуществующему объекту, но ничего не
   * говорит о его воркспейсе — принадлежность тенанту проверяем сами.
   */
  private async requireTarget(
    workspaceId: string,
    entityType: NoteEntityType,
    entityId: string,
  ): Promise<void> {
    const exists = await this.targets[entityType].repository.exists({
      where: { id: entityId, workspaceId },
    });
    if (!exists) {
      throw new NotFoundException(appError('NOTE_TARGET_NOT_FOUND'));
    }
  }

  /** Цель живёт в своей колонке, поэтому раскладываем её в одном месте. */
  private targetColumns(
    entityType: NoteEntityType,
    entityId: string,
  ): Pick<Note, NoteTargetColumn> {
    const empty: Pick<Note, NoteTargetColumn> = {
      statementId: null,
      receiptId: null,
      transactionId: null,
      budgetId: null,
      goalId: null,
      invoiceId: null,
    };
    return { ...empty, [this.targets[entityType].column]: entityId };
  }

  private toView(note: Note): NoteView {
    return {
      id: note.id,
      body: note.body,
      mentionedUserIds: note.mentionedUserIds ?? [],
      resolvedAt: note.resolvedAt,
      createdAt: note.createdAt,
      author: note.user
        ? {
            id: note.user.id,
            // У пользователя может не быть имени — тогда показываем почту.
            name: note.user.name || note.user.email || '—',
          }
        : null,
    };
  }

  async listNotes(
    workspaceId: string,
    entityType: NoteEntityType,
    entityId: string,
  ): Promise<NoteView[]> {
    await this.requireTarget(workspaceId, entityType, entityId);
    const notes = await this.noteRepository.find({
      where: { workspaceId, ...this.targetColumns(entityType, entityId) },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return notes.map(note => this.toView(note));
  }

  async createNote(
    userId: string,
    workspaceId: string,
    entityType: NoteEntityType,
    entityId: string,
    body: string,
    mentionedUserIds: string[] = [],
  ): Promise<NoteView> {
    await this.requireTarget(workspaceId, entityType, entityId);

    const trimmed = (body ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException(appError('NOTE_EMPTY'));
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      throw new BadRequestException(appError('NOTE_TOO_LONG'));
    }

    // Себя упоминать бессмысленно — уведомление всё равно не уйдёт.
    const mentions = [...new Set(mentionedUserIds)].filter(id => id !== userId);
    await this.assertMembers(workspaceId, mentions);

    const saved = await this.noteRepository.save(
      this.noteRepository.create({
        workspaceId,
        ...this.targetColumns(entityType, entityId),
        userId,
        body: trimmed,
        mentionedUserIds: mentions,
      }),
    );

    const withAuthor = await this.noteRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    const view = this.toView(withAuthor ?? saved);

    if (mentions.length) {
      const event: NoteMentionedEvent = {
        workspaceId,
        actorId: userId,
        actorName: view.author?.name ?? '',
        noteId: view.id,
        entityType,
        entityId,
        excerpt: this.buildExcerpt(trimmed),
        mentionedUserIds: mentions,
      };
      this.eventEmitter.emit('note.mentioned', event);
    }

    return view;
  }

  /** Упомянуть можно только коллегу по этому же воркспейсу. */
  private async assertMembers(workspaceId: string, userIds: string[]): Promise<void> {
    if (!userIds.length) {
      return;
    }
    const count = await this.workspaceMemberRepository.count({
      where: { workspaceId, userId: In(userIds) },
    });
    if (count !== userIds.length) {
      throw new BadRequestException(appError('NOTE_MENTION_NOT_A_MEMBER'));
    }
  }

  /** В уведомление уходит начало заметки, а не весь текст. */
  private buildExcerpt(body: string): string {
    const singleLine = body.replace(/\s+/g, ' ').trim();
    return singleLine.length > 140 ? `${singleLine.slice(0, 139)}…` : singleLine;
  }

  async setResolved(workspaceId: string, noteId: string, resolved: boolean): Promise<NoteView> {
    const note = await this.noteRepository.findOne({
      where: { id: noteId, workspaceId },
      relations: ['user'],
    });
    if (!note) {
      throw new NotFoundException(appError('NOTE_NOT_FOUND'));
    }
    note.resolvedAt = resolved ? new Date() : null;
    await this.noteRepository.save(note);
    return this.toView(note);
  }

  async deleteNote(userId: string, workspaceId: string, noteId: string): Promise<void> {
    const note = await this.noteRepository.findOne({ where: { id: noteId, workspaceId } });
    if (!note) {
      throw new NotFoundException(appError('NOTE_NOT_FOUND'));
    }
    if (note.userId !== userId && !(await this.isWorkspaceAdmin(workspaceId, userId))) {
      throw new ForbiddenException(appError('NOTE_DELETE_FORBIDDEN'));
    }
    await this.noteRepository.delete({ id: noteId, workspaceId });
  }

  private async isWorkspaceAdmin(workspaceId: string, userId: string): Promise<boolean> {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
      select: ['role'],
    });
    return Boolean(
      membership && [WorkspaceRole.ADMIN, WorkspaceRole.OWNER].includes(membership.role),
    );
  }

  /** Счётчики нерешённых заметок для списка — чтобы было видно, где идёт обсуждение. */
  async countOpenByEntity(
    workspaceId: string,
    entityType: NoteEntityType,
    entityIds: string[],
  ): Promise<Record<string, number>> {
    if (!entityIds.length) {
      return {};
    }

    const column = `n.${this.targets[entityType].column}`;
    const rows = await this.noteRepository
      .createQueryBuilder('n')
      .select(column, 'entity_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('n.workspaceId = :workspaceId', { workspaceId })
      .andWhere(`${column} IN (:...entityIds)`, { entityIds })
      .andWhere('n.resolvedAt IS NULL')
      .groupBy(column)
      .getRawMany<{ entity_id: string; cnt: string }>();

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.entity_id] = Number(row.cnt) || 0;
    }
    return result;
  }
}
