import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeepPartial, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ERR } from '../../../common/errors/app-error';
import {
  AuditAction,
  AuditEvent,
  type AuditEventDiff,
  EntityType,
} from '../../../entities/audit-event.entity';
import { Category } from '../../../entities/category.entity';
import { CustomTable } from '../../../entities/custom-table.entity';
import { CustomTableColumn } from '../../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../../entities/custom-table-row.entity';
import { Statement } from '../../../entities/statement.entity';
import { Transaction } from '../../../entities/transaction.entity';
import { Workspace } from '../../../entities/workspace.entity';
import type { RollbackResult } from '../interfaces/audit-event.interface';

type SnapshotRecord = Record<string, unknown>;

const asSnapshotRecord = (value: unknown): SnapshotRecord | null =>
  value && typeof value === 'object' ? (value as SnapshotRecord) : null;

/** Entity types `rollback` below can restore; anything else must not be offered as undoable. */
const ROLLBACK_ENTITY_TYPES: ReadonlySet<EntityType> = new Set([
  EntityType.TRANSACTION,
  EntityType.STATEMENT,
  EntityType.CATEGORY,
  EntityType.TABLE_ROW,
  EntityType.TABLE_CELL,
  EntityType.CUSTOM_TABLE,
  EntityType.CUSTOM_TABLE_COLUMN,
  EntityType.WORKSPACE,
]);

@Injectable()
export class RollbackService {
  private readonly logger = new Logger(RollbackService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(CustomTableRow)
    private readonly customTableRowRepository: Repository<CustomTableRow>,
    @InjectRepository(CustomTable)
    private readonly customTableRepository: Repository<CustomTable>,
    @InjectRepository(CustomTableColumn)
    private readonly customTableColumnRepository: Repository<CustomTableColumn>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
  ) {}

  static supports(entityType: EntityType): boolean {
    return ROLLBACK_ENTITY_TYPES.has(entityType);
  }

  async rollback(event: AuditEvent): Promise<RollbackResult> {
    switch (event.entityType) {
      case EntityType.TRANSACTION:
        return this.rollbackTransaction(event);
      case EntityType.STATEMENT:
        return this.rollbackStatement(event);
      case EntityType.CATEGORY:
        return this.rollbackCategory(event);
      case EntityType.TABLE_ROW:
        return this.rollbackCustomTableRow(event);
      case EntityType.TABLE_CELL:
        return this.rollbackCustomTableCell(event);
      case EntityType.CUSTOM_TABLE:
        return this.rollbackCustomTable(event);
      case EntityType.CUSTOM_TABLE_COLUMN:
        return this.rollbackCustomTableColumn(event);
      case EntityType.WORKSPACE:
        return this.rollbackWorkspace(event);
      default:
        return {
          success: false,
          message: `Rollback not supported for entity type ${event.entityType}`,
        };
    }
  }

  async rollbackTransaction(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.transactionRepository);
  }

  async rollbackStatement(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.statementRepository);
  }

  async rollbackCategory(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.categoryRepository);
  }

  async rollbackCustomTableRow(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.customTableRowRepository);
  }

  async rollbackCustomTable(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.customTableRepository);
  }

  async rollbackCustomTableColumn(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.customTableColumnRepository);
  }

  async rollbackWorkspace(event: AuditEvent): Promise<RollbackResult> {
    return this.applyRollback(event, this.workspaceRepository);
  }

  async rollbackCustomTableCell(event: AuditEvent): Promise<RollbackResult> {
    if (event.action !== AuditAction.UPDATE) {
      return { success: false, message: `Rollback not supported for action ${event.action}` };
    }

    const columnKey = event.meta?.cell?.column;
    if (!columnKey) {
      return { success: false, message: 'Missing cell column for rollback' };
    }

    const snapshot = this.extractSnapshots(event.diff);
    if (!snapshot?.before) {
      return { success: false, message: 'Missing before state for rollback' };
    }

    try {
      const row = await this.customTableRowRepository.findOne({ where: { id: event.entityId } });
      if (!row) {
        return { success: false, message: 'Row not found for rollback' };
      }
      if (await this.isAppRecordCell(row, columnKey)) {
        // The cell mirrors an app record: rewriting it here would leave the
        // record as it is and the two disagreeing. The record's own event undoes it.
        return { success: false, message: ERR.CELL_LINKED_TO_APP_RECORD };
      }
      const data: CustomTableRow['data'] = { ...(row.data || {}) };
      data[columnKey] = asSnapshotRecord(snapshot.before)?.value ?? null;
      await this.customTableRowRepository.update(event.entityId, {
        // jsonb: TypeORM's deep-partial type cannot express `unknown` values.
        data: data as QueryDeepPartialEntity<CustomTableRow>['data'],
      });
      return { success: true, message: 'Cell update rolled back' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Rollback failed: ${message}`);
      return { success: false, message };
    }
  }

  /** A source column of a table filled from app data, on a row that came from a record. */
  private async isAppRecordCell(row: CustomTableRow, columnKey: string): Promise<boolean> {
    if (!row.sourceKey) {
      return false;
    }
    const column = await this.customTableColumnRepository.findOne({
      where: { tableId: row.tableId, key: columnKey },
    });
    const source = (column?.config as { source?: { kind?: unknown } } | null | undefined)?.source;
    return source?.kind === 'app_field';
  }

  private async applyRollback<T extends { id: string }>(
    event: AuditEvent,
    repository: Repository<T>,
  ): Promise<RollbackResult> {
    // Safety: rollback only proceeds when a before snapshot exists.
    const snapshot = this.extractSnapshots(event.diff);

    try {
      switch (event.action) {
        case AuditAction.UPDATE: {
          if (!snapshot?.before) {
            return { success: false, message: 'Missing before state for rollback' };
          }
          await repository.update(event.entityId, snapshot.before as QueryDeepPartialEntity<T>);
          return { success: true, message: 'Update rolled back' };
        }
        case AuditAction.DELETE: {
          if (!snapshot?.before) {
            return { success: false, message: 'Missing before state for rollback' };
          }
          let restored = repository.create(snapshot.before as DeepPartial<T>);
          if (event.entityType === EntityType.STATEMENT && 'deletedAt' in restored) {
            const { deletedAt: DeletedAt, ...rest } = restored as unknown as SnapshotRecord;
            restored = rest as unknown as typeof restored;
          }
          await repository.save(restored);
          return { success: true, message: 'Delete rolled back' };
        }
        case AuditAction.CREATE: {
          await repository.delete(event.entityId);
          return { success: true, message: 'Create rolled back' };
        }
        default:
          return { success: false, message: `Rollback not supported for action ${event.action}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Rollback failed: ${message}`);
      return { success: false, message };
    }
  }

  private extractSnapshots(
    diff: AuditEventDiff | null | undefined,
  ): { before: SnapshotRecord | null; after: SnapshotRecord | null } | null {
    if (!diff || Array.isArray(diff)) {
      return null;
    }

    return {
      before: asSnapshotRecord(diff.before),
      after: asSnapshotRecord(diff.after),
    };
  }
}
