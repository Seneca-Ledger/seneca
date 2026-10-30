import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Statement processing used to make up a category for every parsed bank
 * statement from the most frequent word in its rows ("Доходы: Griffith",
 * "Расходы: Card") and set it on the statement. Categories are no longer
 * guessed, so those guesses go.
 *
 * A guessed category is a top-level, non-system category the parser created
 * (source 'parsing') named "Расходы" or "Доходы", alone or followed by ": " and
 * a word. It is taken off bank statements; a receipt keeps it, since a receipt's
 * category was chosen by a person or by the receipt itself. The category is
 * then deleted only if nothing points at it any more: no row, budget, payee,
 * subcategory, receipt, report schedule or any other table. down() restores
 * nothing: the guesses were wrong to begin with.
 */
export class RemoveGuessedStatementCategories1787490000000 implements MigrationInterface {
  name = 'RemoveGuessedStatementCategories1787490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const guessed: Array<{ id: string }> = await queryRunner.query(`
      SELECT id FROM categories
      WHERE source = 'parsing'
        AND is_system = false
        AND parent_id IS NULL
        AND name ~ '^(Расходы|Доходы)(: .+)?$'
    `);
    if (guessed.length === 0) {
      return;
    }
    const ids = guessed.map(category => category.id);

    await queryRunner.query(
      `UPDATE statements SET category_id = NULL
       WHERE category_id = ANY($1::uuid[])
         AND COALESCE(parsing_details ->> 'detectedBy', '') <> 'receipt-scan'
         AND COALESCE(parsing_details -> 'importPreview' ->> 'source', '') <> 'receipt-scan'`,
      [ids],
    );

    const references: Array<{ tbl: string; col: string }> = await queryRunner.query(`
      SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.confrelid = 'categories'::regclass
    `);
    const hasTable = async (table: string) =>
      (await queryRunner.query('SELECT to_regclass($1) AS t', [table]))[0]?.t !== null;
    const hasReportSchedules = await hasTable('report_schedules');
    const hasReceipts = await hasTable('receipts');

    for (const id of ids) {
      let used = false;
      for (const { tbl, col } of references) {
        const [found] = await queryRunner.query(
          `SELECT 1 FROM ${tbl} WHERE "${col}" = $1 LIMIT 1`,
          [id],
        );
        used ||= Boolean(found);
      }
      const [inReceipt] = hasReceipts
        ? await queryRunner.query(
            `SELECT 1 FROM receipts WHERE parsed_data ->> 'categoryId' = $1 LIMIT 1`,
            [id],
          )
        : [];
      const [inSchedule] = hasReportSchedules
        ? await queryRunner.query(
            `SELECT 1 FROM report_schedules
             WHERE jsonb_typeof(category_ids) = 'array' AND category_ids ? $1 LIMIT 1`,
            [id],
          )
        : [];
      if (!(used || inReceipt || inSchedule)) {
        await queryRunner.query('DELETE FROM categories WHERE id = $1', [id]);
      }
    }
  }

  public async down(): Promise<void> {
    // Nothing to restore: the guessed categories were never chosen by anyone.
  }
}
