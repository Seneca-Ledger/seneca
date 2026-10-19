/**
 * One-off backfill: writes `computed` for every table that has formula
 * columns. Needed once after the migration that introduced stored formula
 * values; afterwards every write recalculates on its own.
 *
 *   npm --prefix backend run recalc-tables:dev
 */
import { AppDataSource } from '../src/data-source';
import { CustomTableColumn, CustomTableColumnType } from '../src/entities/custom-table-column.entity';
import { CustomTableRow } from '../src/entities/custom-table-row.entity';
import { FormulaRecalcService } from '../src/modules/custom-tables/formula-recalc.service';

async function main(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  try {
    const columnRepository = AppDataSource.getRepository(CustomTableColumn);
    const rowRepository = AppDataSource.getRepository(CustomTableRow);
    const recalc = new FormulaRecalcService(rowRepository, columnRepository);
    const tableIds = await columnRepository
      .createQueryBuilder('c')
      .select('DISTINCT c.tableId', 'tableId')
      .where('c.type = :type', { type: CustomTableColumnType.FORMULA })
      .getRawMany<{ tableId: string }>();
    console.log(`Tables with formula columns: ${tableIds.length}`);
    for (const { tableId } of tableIds) {
      const result = await recalc.recalcTable(tableId);
      console.log(`${tableId}: ${result.updated}/${result.rows} rows updated`);
    }
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
