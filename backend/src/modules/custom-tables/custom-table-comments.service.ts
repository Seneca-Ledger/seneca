import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableRowComment } from '../../entities/custom-table-row-comment.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';

export interface CommentView {
  id: string;
  body: string;
  resolvedAt: Date | null;
  createdAt: Date;
  author: { id: string; name: string } | null;
}

const MAX_BODY_LENGTH = 4000;

@Injectable()
export class CustomTableCommentsService {
  constructor(
    @InjectRepository(CustomTableRowComment)
    private readonly commentRepository: Repository<CustomTableRowComment>,
    @InjectRepository(CustomTable)
    private readonly tableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableRow)
    private readonly rowRepository: Repository<CustomTableRow>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
  ) {}

  private async ensureCanEditCustomTables(userId: string, workspaceId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditCustomTables',
      'TABLES_EDIT_FORBIDDEN',
    );
  }

  /** Комментарий живёт внутри таблицы, поэтому проверяем и таблицу, и строку. */
  private async requireRow(
    workspaceId: string,
    tableId: string,
    rowId: string,
  ): Promise<CustomTableRow> {
    const table = await this.tableRepository
      .createQueryBuilder('table')
      .where('table.id = :tableId', { tableId })
      .andWhere('table.workspaceId = :workspaceId', { workspaceId })
      .getOne();
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }
    const row = await this.rowRepository.findOne({ where: { id: rowId, tableId } });
    if (!row) {
      throw new NotFoundException(appError('ROW_NOT_FOUND'));
    }
    return row;
  }

  private toView(comment: CustomTableRowComment): CommentView {
    return {
      id: comment.id,
      body: comment.body,
      resolvedAt: comment.resolvedAt,
      createdAt: comment.createdAt,
      author: comment.user
        ? {
            id: comment.user.id,
            // У пользователя может не быть имени — тогда показываем почту.
            name: comment.user.name || comment.user.email || '—',
          }
        : null,
    };
  }

  async listComments(workspaceId: string, tableId: string, rowId: string): Promise<CommentView[]> {
    await this.requireRow(workspaceId, tableId, rowId);
    const comments = await this.commentRepository.find({
      where: { rowId, tableId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return comments.map(comment => this.toView(comment));
  }

  async addComment(
    userId: string,
    workspaceId: string,
    tableId: string,
    rowId: string,
    body: string,
  ): Promise<CommentView> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    await this.requireRow(workspaceId, tableId, rowId);
    const trimmed = (body ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException(appError('COMMENT_EMPTY'));
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      throw new BadRequestException(appError('COMMENT_TOO_LONG'));
    }

    const saved = await this.commentRepository.save(
      this.commentRepository.create({
        rowId,
        tableId,
        workspaceId,
        userId,
        body: trimmed,
      }),
    );
    const withAuthor = await this.commentRepository.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    return this.toView(withAuthor ?? saved);
  }

  async setResolved(
    userId: string,
    workspaceId: string,
    commentId: string,
    resolved: boolean,
  ): Promise<CommentView> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, workspaceId },
      relations: ['user'],
    });
    if (!comment) {
      throw new NotFoundException(appError('COMMENT_NOT_FOUND'));
    }
    comment.resolvedAt = resolved ? new Date() : null;
    await this.commentRepository.save(comment);
    return this.toView(comment);
  }

  async deleteComment(userId: string, workspaceId: string, commentId: string): Promise<void> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, workspaceId },
    });
    if (!comment) {
      throw new NotFoundException(appError('COMMENT_NOT_FOUND'));
    }
    await this.commentRepository.delete({ id: commentId });
  }

  /** Счётчики для грида: чтобы было видно, где обсуждение уже идёт. */
  async countOpenByRow(workspaceId: string, tableId: string): Promise<Record<string, number>> {
    const rows = await this.commentRepository
      .createQueryBuilder('c')
      .select('c.rowId', 'row_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.tableId = :tableId', { tableId })
      .andWhere('c.workspaceId = :workspaceId', { workspaceId })
      .andWhere('c.resolvedAt IS NULL')
      .groupBy('c.rowId')
      .getRawMany<{ row_id: string; cnt: string }>();

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.row_id] = Number(row.cnt) || 0;
    }
    return result;
  }
}
