import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A receipt scan files its statement and the single transaction it produces
 * under the same category. Picking a category on the receipt afterwards moved
 * only the statement, so the transaction kept the fallback category chosen at
 * scan time — and the dashboard, which aggregates by transaction category, kept
 * charting that spend under the wrong category.
 *
 * Realigns those transactions with their statement. Statements parsed from a
 * bank file carry unrelated transactions and are left alone.
 */
export class BackfillReceiptScanTransactionCategories1786270000000 implements MigrationInterface {
  name = 'BackfillReceiptScanTransactionCategories1786270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "transactions" AS t
      SET "category_id" = s."category_id"
      FROM "statements" AS s
      WHERE s."id" = t."statement_id"
        AND s."workspace_id" = t."workspace_id"
        AND s."parsing_details" ->> 'detectedBy' = 'receipt-scan'
        AND s."category_id" IS NOT NULL
        AND t."category_id" IS DISTINCT FROM s."category_id"
    `);
  }

  public async down(): Promise<void> {
    // Intentionally no-op: the overwritten categories were the fallback picked
    // at scan time and are not recorded anywhere, so there is nothing to restore.
  }
}
