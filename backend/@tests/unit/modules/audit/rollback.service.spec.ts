import { AuditAction, type AuditEvent, EntityType } from '@/entities/audit-event.entity';
import { Category } from '@/entities/category.entity';
import { CustomTableColumn } from '@/entities/custom-table-column.entity';
import { CustomTable } from '@/entities/custom-table.entity';
import { CustomTableRow } from '@/entities/custom-table-row.entity';
import { Statement } from '@/entities/statement.entity';
import { Transaction } from '@/entities/transaction.entity';
import { Workspace } from '@/entities/workspace.entity';
import { RollbackService } from '@/modules/audit/rollback/rollback.service';
import type { Repository } from 'typeorm';

function createRepoMock<T extends Record<string, any>>() {
  return {
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
    create: jest.fn((data: Partial<T>) => data as T),
    save: jest.fn(async (data: Partial<T>) => data as T),
    findOne: jest.fn(async () => null),
  } as unknown as Repository<T> & Record<string, any>;
}

describe('RollbackService', () => {
  const transactionRepository = createRepoMock<Transaction>();
  const statementRepository = createRepoMock<Statement>();
  const categoryRepository = createRepoMock<Category>();
  const customTableRowRepository = createRepoMock<CustomTableRow>();
  const customTableRepository = createRepoMock<CustomTable>();
  const customTableColumnRepository = createRepoMock<CustomTableColumn>();
  const workspaceRepository = createRepoMock<Workspace>();

  let service: RollbackService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RollbackService(
      transactionRepository as any,
      statementRepository as any,
      categoryRepository as any,
      customTableRowRepository as any,
      customTableRepository as any,
      customTableColumnRepository as any,
      workspaceRepository as any,
    );
  });

  it('rolls back transaction updates using before snapshot', async () => {
    const event: AuditEvent = {
      id: 'evt-1',
      entityId: 't1',
      entityType: EntityType.TRANSACTION,
      action: AuditAction.UPDATE,
      diff: { before: { amount: 10 }, after: { amount: 20 } },
    } as AuditEvent;

    const result = await service.rollback(event);

    expect(transactionRepository.update).toHaveBeenCalledWith('t1', { amount: 10 });
    expect(result.success).toBe(true);
  });

  it('rolls back statement delete by recreating entity', async () => {
    const event: AuditEvent = {
      id: 'evt-2',
      entityId: 's1',
      entityType: EntityType.STATEMENT,
      action: AuditAction.DELETE,
      diff: { before: { id: 's1', name: 'Stmt' }, after: null },
    } as AuditEvent;

    const result = await service.rollback(event);

    expect(statementRepository.create).toHaveBeenCalledWith({ id: 's1', name: 'Stmt' });
    expect(statementRepository.save).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('rolls back category create by deleting entity', async () => {
    const event: AuditEvent = {
      id: 'evt-3',
      entityId: 'c1',
      entityType: EntityType.CATEGORY,
      action: AuditAction.CREATE,
      diff: { before: null, after: { id: 'c1', name: 'Cat' } },
    } as AuditEvent;

    const result = await service.rollback(event);

    expect(categoryRepository.delete).toHaveBeenCalledWith('c1');
    expect(result.success).toBe(true);
  });

  it('rolls back table cell updates by restoring prior value', async () => {
    const event: AuditEvent = {
      id: 'evt-4',
      entityId: 'row-1',
      entityType: EntityType.TABLE_CELL,
      action: AuditAction.UPDATE,
      diff: { before: { value: 'old' }, after: { value: 'new' } },
      meta: { cell: { column: 'amount' } },
    } as AuditEvent;

    (customTableRowRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'row-1',
      data: { amount: 'new', other: 1 },
    });

    const result = await service.rollback(event);

    expect(customTableRowRepository.update).toHaveBeenCalledWith('row-1', {
      data: { amount: 'old', other: 1 },
    });
    expect(result.success).toBe(true);
  });

  describe('cells that show an app record', () => {
    const cellEvent = {
      id: 'evt-cell',
      entityId: 'row-1',
      entityType: EntityType.TABLE_CELL,
      action: AuditAction.UPDATE,
      diff: { before: { value: 'Rent' }, after: { value: 'Travel' } },
      meta: { cell: { column: 'c_category' } },
    } as AuditEvent;

    it('refuses to rewrite a source column of a row that came from a record', async () => {
      (customTableRowRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'row-1',
        tableId: 'table-1',
        sourceKey: 'tx-1',
        data: { c_category: 'Travel' },
      });
      (customTableColumnRepository.findOne as jest.Mock).mockResolvedValue({
        key: 'c_category',
        config: { source: { kind: 'app_field', field: 'category' } },
      });

      const result = await service.rollback(cellEvent);

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/app record/);
      expect(customTableRowRepository.update).not.toHaveBeenCalled();
      expect(customTableColumnRepository.findOne).toHaveBeenCalledWith({
        where: { tableId: 'table-1', key: 'c_category' },
      });
    });

    it('still rolls back a plain column of the same row', async () => {
      (customTableRowRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'row-1',
        tableId: 'table-1',
        sourceKey: 'tx-1',
        data: { c_category: 'Travel' },
      });
      (customTableColumnRepository.findOne as jest.Mock).mockResolvedValue({
        key: 'c_category',
        config: null,
      });

      const result = await service.rollback(cellEvent);

      expect(result.success).toBe(true);
      expect(customTableRowRepository.update).toHaveBeenCalledWith('row-1', {
        data: { c_category: 'Rent' },
      });
    });

    it('still rolls back a hand-added row of a source table', async () => {
      (customTableRowRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'row-1',
        tableId: 'table-1',
        sourceKey: null,
        data: { c_category: 'Travel' },
      });

      const result = await service.rollback(cellEvent);

      expect(result.success).toBe(true);
      expect(customTableColumnRepository.findOne).not.toHaveBeenCalled();
    });
  });

  it('rolls back custom table delete by recreating entity', async () => {
    const event: AuditEvent = {
      id: 'evt-5',
      entityId: 'table-1',
      entityType: EntityType.CUSTOM_TABLE,
      action: AuditAction.DELETE,
      diff: { before: { id: 'table-1', name: 'Products' }, after: null },
    } as AuditEvent;

    const result = await service.rollback(event);

    expect(customTableRepository.create).toHaveBeenCalledWith({ id: 'table-1', name: 'Products' });
    expect(customTableRepository.save).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('rolls back custom table column update with before snapshot', async () => {
    const event: AuditEvent = {
      id: 'evt-6',
      entityId: 'column-1',
      entityType: EntityType.CUSTOM_TABLE_COLUMN,
      action: AuditAction.UPDATE,
      diff: { before: { title: 'Old title' }, after: { title: 'New title' } },
    } as AuditEvent;

    const result = await service.rollback(event);

    expect(customTableColumnRepository.update).toHaveBeenCalledWith('column-1', {
      title: 'Old title',
    });
    expect(result.success).toBe(true);
  });

  it('rolls back workspace update with before snapshot', async () => {
    const event: AuditEvent = {
      id: 'evt-7',
      entityId: 'workspace-1',
      entityType: EntityType.WORKSPACE,
      action: AuditAction.UPDATE,
      diff: {
        before: { name: 'Old workspace', color: '#000000' },
        after: { name: 'New workspace', color: '#ffffff' },
      },
    } as AuditEvent;

    const result = await service.rollback(event);

    expect(workspaceRepository.update).toHaveBeenCalledWith('workspace-1', {
      name: 'Old workspace',
      color: '#000000',
    });
    expect(result.success).toBe(true);
  });
});
