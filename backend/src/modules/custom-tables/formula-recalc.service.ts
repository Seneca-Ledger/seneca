import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import {
  CustomTableColumn,
  CustomTableColumnType,
} from '../../entities/custom-table-column.entity';
import { CustomTableRow } from '../../entities/custom-table-row.entity';
import { type FormulaColumnLike, TableEvaluator } from './helpers/table-evaluator';
import {
  CUSTOM_TABLE_RECALC_QUEUE,
  type CustomTableRecalcJob,
} from './queue/custom-table-recalc.queue';

type JsonObject = Record<string, unknown>;

/** Up to this many rows the recalc runs inside the request; beyond it goes to the queue. */
export const RECALC_SYNC_ROW_LIMIT = 5000;
const UPDATE_CHUNK = 500;
/** Jobs within one bucket collapse into one run; a new bucket starts while the previous is busy. */
const JOB_BUCKET_MS = 5000;

const toRecord = (value: unknown): JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonObject) : {};

export const formulaColumnsOf = (columns: CustomTableColumn[]): FormulaColumnLike[] =>
  columns
    .filter(
      col =>
        col.type === CustomTableColumnType.FORMULA && typeof col.config?.expression === 'string',
    )
    .map(col => ({ key: col.key, expression: col.config?.expression as string }));

/**
 * Writes formula values into `custom_table_rows.computed`. Runs after every
 * change to rows or columns; reads then merge `computed` into `data`, so
 * filters, sorting, totals and export all see the same numbers as the grid.
 */
@Injectable()
export class FormulaRecalcService {
  private readonly logger = new Logger(FormulaRecalcService.name);

  constructor(
    @InjectRepository(CustomTableRow)
    private readonly rowRepository: Repository<CustomTableRow>,
    @InjectRepository(CustomTableColumn)
    private readonly columnRepository: Repository<CustomTableColumn>,
    @Optional()
    @InjectQueue(CUSTOM_TABLE_RECALC_QUEUE)
    private readonly queue?: Queue<CustomTableRecalcJob>,
  ) {}

  /** Recalculate now for small tables, otherwise enqueue; falls back to sync when Redis is down. */
  async scheduleRecalc(tableId: string, workspaceId: string): Promise<'sync' | 'queued'> {
    const count = await this.rowRepository.count({ where: { tableId } });
    if (count <= RECALC_SYNC_ROW_LIMIT || !this.queue) {
      await this.recalcTable(tableId);
      return 'sync';
    }
    try {
      await this.queue.add(
        'recalc',
        { tableId, workspaceId },
        {
          jobId: `recalc-${tableId}-${Math.floor(Date.now() / JOB_BUCKET_MS)}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
      return 'queued';
    } catch (error) {
      this.logger.warn(`Recalc queue unavailable, running inline for ${tableId}: ${String(error)}`);
      await this.recalcTable(tableId);
      return 'sync';
    }
  }

  /** All rows with data and computed merged, plus an evaluator over them (for previews and summaries). */
  async buildEvaluator(
    tableId: string,
    columns?: CustomTableColumn[],
  ): Promise<{
    evaluator: TableEvaluator;
    rows: CustomTableRow[];
    formulaColumns: FormulaColumnLike[];
  }> {
    const allColumns = columns ?? (await this.columnRepository.find({ where: { tableId } }));
    const formulaColumns = formulaColumnsOf(allColumns);
    const rows = await this.rowRepository.find({
      where: { tableId },
      select: ['id', 'rowNumber', 'data', 'computed'],
      order: { rowNumber: 'ASC', id: 'ASC' },
    });
    // Formula keys start empty: stale values of a removed or edited formula must not leak in.
    const evaluator = new TableEvaluator(rows.map(row => ({ ...toRecord(row.data) })));
    evaluator.computeAll(formulaColumns);
    return { evaluator, rows, formulaColumns };
  }

  async recalcTable(tableId: string): Promise<{ rows: number; updated: number }> {
    const { evaluator, rows, formulaColumns } = await this.buildEvaluator(tableId);
    const keys = formulaColumns.map(col => col.key);
    const updates: Array<{ id: string; computed: JsonObject }> = [];
    rows.forEach((row, index) => {
      const next: JsonObject = {};
      for (const key of keys) {
        next[key] = evaluator.rows[index][key] ?? null;
      }
      if (JSON.stringify(next) !== JSON.stringify(toRecord(row.computed))) {
        updates.push({ id: row.id, computed: next });
      }
    });
    for (let index = 0; index < updates.length; index += UPDATE_CHUNK) {
      await this.writeComputed(updates.slice(index, index + UPDATE_CHUNK));
    }
    return { rows: rows.length, updated: updates.length };
  }

  /** One statement per chunk: a row-by-row UPDATE would make a 5 000-row recalc crawl. */
  private async writeComputed(updates: Array<{ id: string; computed: JsonObject }>): Promise<void> {
    if (!updates.length) {
      return;
    }
    const values: string[] = [];
    const params: unknown[] = [];
    updates.forEach((update, index) => {
      values.push(`($${index * 2 + 1}::uuid, $${index * 2 + 2}::jsonb)`);
      params.push(update.id, JSON.stringify(update.computed));
    });
    await this.rowRepository.query(
      `UPDATE custom_table_rows AS r SET computed = v.computed, updated_at = NOW()
       FROM (VALUES ${values.join(', ')}) AS v(id, computed)
       WHERE r.id = v.id`,
      params,
    );
  }
}
