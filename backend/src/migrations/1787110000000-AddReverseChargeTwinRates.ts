import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives workspaces that already file in an EU country the reverse-charge twin
 * of their standard rate, which adopting a jurisdiction now creates.
 *
 * An intra-EU invoice to a VAT-registered business carries no VAT, and the
 * twin is the rate an invoice line picks for it. Without this, only a
 * workspace that picked its country after the change would have one.
 * Every version of the standard rate gets its own twin, so a twin is in force
 * exactly when its standard rate is. Only rows are added.
 */
export class AddReverseChargeTwinRates1787110000000 implements MigrationInterface {
  name = 'AddReverseChargeTwinRates1787110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "tax_rates" (
        "workspace_id", "jurisdiction_id", "code", "name", "rate", "kind",
        "is_default", "valid_from", "valid_to", "is_inclusive", "is_reverse_charge", "is_enabled"
      )
      SELECT r."workspace_id", r."jurisdiction_id", r."code" || '_RC',
             r."name" || ' — reverse charge', r."rate", r."kind",
             false, r."valid_from", r."valid_to", r."is_inclusive", true, r."is_enabled"
        FROM "tax_rates" r
        JOIN "tax_jurisdictions" j ON j."id" = r."jurisdiction_id"
        JOIN "workspaces" w ON w."id" = r."workspace_id" AND w."tax_jurisdiction_id" = r."jurisdiction_id"
       WHERE j."is_eu" = true
         AND r."kind" = 'standard'
         AND r."code" IS NOT NULL
         AND r."code" NOT LIKE '%\\_RC'
         AND r."is_reverse_charge" = false
         AND NOT EXISTS (
           SELECT 1 FROM "tax_rates" t
            WHERE t."workspace_id" = r."workspace_id"
              AND t."code" = r."code" || '_RC'
              AND t."valid_from" = r."valid_from"
         )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only twins nothing points at: a transaction or an invoice line taxed at
    // one keeps it.
    await queryRunner.query(`
      DELETE FROM "tax_rates" r
       WHERE r."code" LIKE '%\\_RC'
         AND r."is_reverse_charge" = true
         AND NOT EXISTS (SELECT 1 FROM "transactions" t WHERE t."tax_rate_id" = r."id")
         AND NOT EXISTS (SELECT 1 FROM "invoice_line_items" i WHERE i."tax_rate_id" = r."id")
         AND NOT EXISTS (SELECT 1 FROM "credit_note_line_items" c WHERE c."tax_rate_id" = r."id")
    `);
  }
}
