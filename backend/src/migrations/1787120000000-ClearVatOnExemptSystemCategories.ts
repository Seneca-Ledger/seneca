import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Takes the default VAT off rows booked to seeded categories that carry none:
 * interest (an exempt financial service), wages and staff benefits (not a
 * supply) and, outside the UAE, insurance. The engine now skips them; this
 * clears what it assessed before.
 *
 * Only figures that came from the workspace default go — a rate the user
 * picked or a rule they wrote stays — and rows on a filed return keep what
 * was filed.
 */
export class ClearVatOnExemptSystemCategories1787120000000 implements MigrationInterface {
  name = 'ClearVatOnExemptSystemCategories1787120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "transactions" t SET
        "tax_rate_id" = NULL,
        "tax_rule_id" = NULL,
        "tax_source" = NULL,
        "tax_amount" = NULL,
        "tax_net_amount" = NULL,
        "tax_notional_amount" = NULL,
        "tax_reverse_charge" = false
      FROM "categories" c
      JOIN "workspaces" w ON w."id" = c."workspace_id"
      LEFT JOIN "tax_jurisdictions" j ON j."id" = w."tax_jurisdiction_id"
      WHERE t."tax_locked" = false
        AND t."tax_source" = 'default'
        AND t."workspace_id" = c."workspace_id"
        AND (
          t."category_id" = c."id"
          OR t."category_id" IN (SELECT child."id" FROM "categories" child WHERE child."parent_id" = c."id")
        )
        AND c."is_system" = true
        AND (
          c."name" IN ('Interest income', 'Interest', 'Payroll', 'Benefits and compensation')
          OR (c."name" = 'Insurance' AND COALESCE(j."code", '') <> 'AE')
        )
    `);
  }

  public async down(): Promise<void> {
    // Nothing to restore: re-applying the tax rules rebuilds any figure that should exist.
  }
}
