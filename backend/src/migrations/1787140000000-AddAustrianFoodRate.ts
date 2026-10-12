import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Austria's 4.9% rate on foodstuffs (Annex 3 to § 10 UStG 1994), in force
 * from 1 July 2026 and missing from the seed until the comparison with the
 * European Commission's TEDB found it. Added to the reference rates and to
 * every workspace that files in Austria and does not have it yet — taking it
 * over from that comparison already gave it the same code. Only rows are
 * added; no transaction is assessed again, since no rule points at the new
 * rate until the user maps a category to it.
 */
export class AddAustrianFoodRate1787140000000 implements MigrationInterface {
  name = 'AddAustrianFoodRate1787140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "tax_jurisdiction_rates"
        ("jurisdiction_id", "code", "name", "rate", "kind", "is_default", "valid_from", "valid_to")
      SELECT j."id", 'AT_REDUCED_4_9', 'USt 4.9%', 4.9, 'reduced', false, '2026-07-01', NULL
        FROM "tax_jurisdictions" j
       WHERE j."code" = 'AT'
      ON CONFLICT ("jurisdiction_id", "code", "valid_from") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "tax_rates" (
        "workspace_id", "jurisdiction_id", "code", "name", "rate", "kind",
        "is_default", "valid_from", "valid_to", "is_inclusive", "is_reverse_charge", "is_enabled"
      )
      SELECT w."id", j."id", 'AT_REDUCED_4_9', 'USt 4.9%', 4.9, 'reduced',
             false, '2026-07-01', NULL, true, false, true
        FROM "workspaces" w
        JOIN "tax_jurisdictions" j ON j."id" = w."tax_jurisdiction_id" AND j."code" = 'AT'
       WHERE NOT EXISTS (
         SELECT 1 FROM "tax_rates" t
          WHERE t."workspace_id" = w."id"
            AND t."is_reverse_charge" = false
            AND t."rate" = 4.9
       )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only copies nothing points at: a row or an invoice line taxed at one keeps it.
    await queryRunner.query(`
      DELETE FROM "tax_rates" r
       WHERE r."code" = 'AT_REDUCED_4_9'
         AND NOT EXISTS (SELECT 1 FROM "transactions" t WHERE t."tax_rate_id" = r."id")
         AND NOT EXISTS (SELECT 1 FROM "invoice_line_items" i WHERE i."tax_rate_id" = r."id")
         AND NOT EXISTS (SELECT 1 FROM "credit_note_line_items" c WHERE c."tax_rate_id" = r."id")
         AND NOT EXISTS (SELECT 1 FROM "tax_rules" u WHERE u."tax_rate_code" = r."code" AND u."workspace_id" = r."workspace_id")
    `);
    await queryRunner.query(`
      DELETE FROM "tax_jurisdiction_rates" r
       USING "tax_jurisdictions" j
       WHERE r."jurisdiction_id" = j."id" AND j."code" = 'AT' AND r."code" = 'AT_REDUCED_4_9'
    `);
  }
}
