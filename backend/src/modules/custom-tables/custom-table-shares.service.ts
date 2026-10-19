import { randomBytes } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { CustomTable } from '../../entities/custom-table.entity';
import { CustomTableColumn } from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { CustomTableShare, CustomTableShareStatus } from '../../entities/custom-table-share.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditService } from '../audit/audit.service';

/** Срок жизни ссылки по умолчанию: бессрочные ссылки на финданные — плохая идея. */
const DEFAULT_EXPIRY_DAYS = 30;
const MAX_EXPIRY_DAYS = 365;

export interface SharedTableView {
  table: { id: string; name: string; description: string | null };
  columns: Array<{ key: string; title: string; type: string; position: number }>;
}

@Injectable()
export class CustomTableSharesService {
  constructor(
    @InjectRepository(CustomTableShare)
    private readonly shareRepository: Repository<CustomTableShare>,
    @InjectRepository(CustomTable)
    private readonly tableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private readonly columnRepository: Repository<CustomTableColumn>,
    @InjectRepository(CustomTableRow)
    private readonly rowRepository: Repository<CustomTableRow>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly auditService: AuditService,
  ) {}

  /** Выдача и отзыв внешнего доступа — привилегия редакторов таблиц. */
  private async ensureCanEditCustomTables(userId: string, workspaceId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditCustomTables',
      'TABLES_EDIT_FORBIDDEN',
    );
  }

  /** Таблица обязана принадлежать воркспейсу — иначе поделиться чужим. */
  private async requireTable(workspaceId: string, tableId: string): Promise<CustomTable> {
    const table = await this.tableRepository
      .createQueryBuilder('table')
      .where('table.id = :tableId', { tableId })
      .andWhere('table.workspaceId = :workspaceId', { workspaceId })
      .getOne();
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }
    return table;
  }

  async createShare(
    userId: string,
    workspaceId: string,
    tableId: string,
    options: { expiresInDays?: number } = {},
  ): Promise<{ share: CustomTableShare; token: string }> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const table = await this.requireTable(workspaceId, tableId);

    const days = Math.min(
      Math.max(options.expiresInDays ?? DEFAULT_EXPIRY_DAYS, 1),
      MAX_EXPIRY_DAYS,
    );
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const token = randomBytes(32).toString('hex');

    const share = await this.shareRepository.save(
      this.shareRepository.create({
        tableId: table.id,
        workspaceId,
        createdById: userId,
        token,
        expiresAt,
        status: CustomTableShareStatus.ACTIVE,
      }),
    );

    // Выдача доступа наружу — событие для аудита, а не рядовая правка.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: table.id,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      meta: { share: 'created', shareId: share.id, expiresAt },
    });

    return { share, token };
  }

  async listShares(workspaceId: string, tableId: string): Promise<CustomTableShare[]> {
    await this.requireTable(workspaceId, tableId);
    return this.shareRepository.find({
      where: { tableId, workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeShare(userId: string, workspaceId: string, shareId: string): Promise<void> {
    await this.ensureCanEditCustomTables(userId, workspaceId);
    const share = await this.shareRepository.findOne({ where: { id: shareId, workspaceId } });
    if (!share) {
      throw new NotFoundException(appError('SHARE_LINK_NOT_FOUND'));
    }
    share.status = CustomTableShareStatus.REVOKED;
    await this.shareRepository.save(share);

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.CUSTOM_TABLE,
      entityId: share.tableId,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      meta: { share: 'revoked', shareId: share.id },
    });
  }

  /**
   * Разбор публичного токена. Отзыв и истечение проверяются здесь — это
   * единственная точка, через которую данные уходят наружу без авторизации.
   */
  private async resolveActiveShare(token: string): Promise<CustomTableShare> {
    if (token?.length !== 64) {
      throw new NotFoundException(appError('SHARE_LINK_NOT_FOUND'));
    }
    const share = await this.shareRepository.findOne({ where: { token } });
    if (!share) {
      throw new NotFoundException(appError('SHARE_LINK_NOT_FOUND'));
    }
    if (share.status !== CustomTableShareStatus.ACTIVE) {
      throw new ForbiddenException(appError('SHARE_LINK_REVOKED'));
    }
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      share.status = CustomTableShareStatus.EXPIRED;
      await this.shareRepository.save(share);
      throw new ForbiddenException(appError('SHARE_LINK_EXPIRED'));
    }
    return share;
  }

  async getSharedTable(token: string): Promise<SharedTableView> {
    const share = await this.resolveActiveShare(token);

    const table = await this.tableRepository.findOne({ where: { id: share.tableId } });
    if (!table) {
      throw new NotFoundException(appError('TABLE_NOT_FOUND'));
    }

    const columns = await this.columnRepository.find({
      where: { tableId: share.tableId },
      order: { position: 'ASC' },
    });

    share.accessCount += 1;
    share.lastAccessedAt = new Date();
    await this.shareRepository.save(share);

    // Наружу отдаём только то, что нужно для просмотра: ни владельца,
    // ни воркспейса, ни настроек интеграций.
    return {
      table: { id: table.id, name: table.name, description: table.description },
      columns: columns.map(col => ({
        key: col.key,
        title: col.title,
        type: col.type,
        position: col.position,
      })),
    };
  }

  async getSharedRows(
    token: string,
    params: { cursor?: number; limit?: number },
  ): Promise<{ items: Array<{ rowNumber: number; data: unknown }>; total: number }> {
    const share = await this.resolveActiveShare(token);

    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const query = this.rowRepository
      .createQueryBuilder('r')
      .where('r.tableId = :tableId', { tableId: share.tableId })
      .orderBy('r.rowNumber', 'ASC')
      .take(limit);

    const total = await query.getCount();
    if (params.cursor !== undefined) {
      query.andWhere('r.rowNumber > :cursor', { cursor: params.cursor });
    }
    const rows = await query.getMany();

    // Идентификаторы строк наружу не отдаём: по ссылке доступен только просмотр,
    // а id — это ключ к операциям записи в приватном API.
    return {
      items: rows.map(row => ({ rowNumber: row.rowNumber, data: row.data })),
      total,
    };
  }
}
