import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The fallback category was created as 'Без категории' whatever the language,
 * and by a check-then-insert, so statements processed in parallel made several
 * of them in one workspace. Per workspace and type this keeps one (an existing
 * 'Uncategorized' first, then the oldest), points every reference of the others
 * at it, deletes them, names it 'Uncategorized' and adds a unique index so the
 * race cannot make a second one again.
 *
 * Rows that would break a unique index on the way (a budget, tax rule or tax
 * line mapping that the kept category already has) are dropped: the kept one
 * already says the same. down() only drops the index; merged rows stay merged.
 */
export class UnifyUncategorizedCategory1786810000000 implements MigrationInterface {
  name = 'UnifyUncategorizedCategory1786810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const groups: Array<{ ids: string[] }> = await queryRunner.query(`
      SELECT array_agg(id ORDER BY (name = 'Uncategorized') DESC, created_at, id) AS ids
      FROM categories
      WHERE parent_id IS NULL
        AND workspace_id IS NOT NULL
        AND lower(trim(name)) IN ('uncategorized', 'без категории')
      GROUP BY workspace_id, type
    `);
    const references: Array<{ tbl: string; col: string }> = await queryRunner.query(`
      SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.confrelid = 'categories'::regclass
    `);
    const hasTable = async (table: string) =>
      (await queryRunner.query('SELECT to_regclass($1) AS t', [table]))[0]?.t !== null;
    const hasReportSchedules = await hasTable('report_schedules');

    for (const { ids } of groups) {
      const [kept, ...duplicates] = ids;
      for (const duplicate of duplicates) {
        await queryRunner.query(
          `DELETE FROM budgets b WHERE b.category_id = $1 AND EXISTS (
             SELECT 1 FROM budgets k WHERE k.category_id = $2 AND k.workspace_id = b.workspace_id
               AND k.period_type = b.period_type AND k.goal_id IS NOT DISTINCT FROM b.goal_id)`,
          [duplicate, kept],
        );
        await queryRunner.query(
          `DELETE FROM tax_rules r WHERE r.category_id = $1 AND EXISTS (
             SELECT 1 FROM tax_rules k WHERE k.category_id = $2 AND k.workspace_id = r.workspace_id
               AND k.direction = r.direction)`,
          [duplicate, kept],
        );
        await queryRunner.query(
          `DELETE FROM income_tax_line_mappings m WHERE m.category_id = $1 AND EXISTS (
             SELECT 1 FROM income_tax_line_mappings k WHERE k.category_id = $2
               AND k.workspace_id = m.workspace_id AND k.form_key = m.form_key)`,
          [duplicate, kept],
        );
        for (const { tbl, col } of references) {
          await queryRunner.query(`UPDATE ${tbl} SET "${col}" = $2 WHERE "${col}" = $1`, [
            duplicate,
            kept,
          ]);
        }
        if (hasReportSchedules) {
          await queryRunner.query(
            `UPDATE report_schedules SET category_ids = (
               SELECT jsonb_agg(DISTINCT CASE WHEN v = $1 THEN $2 ELSE v END)
               FROM jsonb_array_elements_text(category_ids) v)
             WHERE jsonb_typeof(category_ids) = 'array' AND category_ids ? $1`,
            [duplicate, kept],
          );
        }
        await queryRunner.query('DELETE FROM categories WHERE id = $1', [duplicate]);
      }
      await queryRunner.query(`UPDATE categories SET name = 'Uncategorized' WHERE id = $1`, [kept]);
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_uncategorized"
        ON categories (workspace_id, type)
        WHERE name = 'Uncategorized' AND parent_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "UQ_categories_uncategorized"');
  }
}
