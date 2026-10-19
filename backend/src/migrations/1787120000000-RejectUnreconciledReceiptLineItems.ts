import { MigrationInterface, QueryRunner } from 'typeorm';

const NUMBER = `'^-?[0-9]+(\\.[0-9]+)?$'`;
const num = (path: string) =>
  `CASE WHEN "parsed_data"->>'${path}' ~ ${NUMBER} THEN ("parsed_data"->>'${path}')::numeric END`;

/**
 * Line items that do not add up to the receipt (within 5% of the subtotal, the
 * total, or the total less tax) are page numbers, dates and postcodes the
 * extractor read as prices. New scans drop them (lineItemsReconcile); this moves
 * the ones already stored to "rejectedLineItems", so down() can put them back.
 */
export class RejectUnreconciledReceiptLineItems1787120000000 implements MigrationInterface {
  name = 'RejectUnreconciledReceiptLineItems1787120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH figures AS (
        SELECT
          "id",
          ${num('amount')} AS total,
          ${num('subtotal')} AS subtotal,
          ${num('tax')} AS tax,
          (
            SELECT COALESCE(SUM(
              CASE WHEN item->>'amount' ~ ${NUMBER} THEN (item->>'amount')::numeric ELSE 0 END
            ), 0)
            FROM jsonb_array_elements("parsed_data"->'lineItems') item
          ) AS items_sum
        FROM "receipts"
        WHERE jsonb_typeof("parsed_data"->'lineItems') = 'array'
          AND jsonb_array_length("parsed_data"->'lineItems') > 0
      )
      UPDATE "receipts" r
      SET "parsed_data" = (r."parsed_data" - 'lineItems')
        || jsonb_build_object('lineItems', '[]'::jsonb, 'rejectedLineItems', r."parsed_data"->'lineItems')
      FROM figures f
      WHERE r."id" = f."id"
        AND NOT (
          COALESCE(f.subtotal > 0 AND abs(f.items_sum - f.subtotal) <= f.subtotal * 0.05, false)
          OR COALESCE(f.total > 0 AND abs(f.items_sum - f.total) <= f.total * 0.05, false)
          OR COALESCE(
            f.total > 0 AND f.tax > 0 AND f.total - f.tax > 0
              AND abs(f.items_sum - (f.total - f.tax)) <= (f.total - f.tax) * 0.05,
            false
          )
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "receipts"
      SET "parsed_data" = ("parsed_data" - 'rejectedLineItems')
        || jsonb_build_object('lineItems', "parsed_data"->'rejectedLineItems')
      WHERE "parsed_data" ? 'rejectedLineItems'
    `);
  }
}
