export const CUSTOM_TABLE_RECALC_QUEUE = 'custom-table-recalc';

export interface CustomTableRecalcJob {
  tableId: string;
  workspaceId: string;
}
