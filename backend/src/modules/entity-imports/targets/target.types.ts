import type { EntityManager } from 'typeorm';
import type { ImportCreatedRef, ImportUpdatedRef } from '../../../entities/import-batch.entity';
import type { ImportTargetKind } from '../target-aliases';

export type RowStatus = 'created' | 'updated' | 'skipped' | 'error';

export interface RowResult {
  index: number;
  status: RowStatus;
  /** Machine-readable reason for skipped/error rows (translated on the client). */
  reason?: string;
  id?: string;
}

export interface ImportContext {
  workspaceId: string;
  userId: string;
  manager: EntityManager;
  currency: string;
  fileName: string | null;
  categorize: boolean;
  /** Read a mapped cell of a row; '' when the field is not mapped. */
  cell(row: string[], field: string): string;
  /** Category by name, created on first use; null for a blank name. */
  category(name: string, type: 'income' | 'expense'): Promise<string | null>;
  created: ImportCreatedRef[];
  updated: ImportUpdatedRef[];
}

export interface ImportTarget {
  kind: ImportTargetKind;
  /** Rows stay in input order; every row gets exactly one result. */
  run(rows: string[][], ctx: ImportContext, dryRun: boolean): Promise<RowResult[]>;
}
