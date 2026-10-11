import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What the tax engine needs to stop guessing.
 *
 * - `workspaces.vat_status`: whether the workspace charges VAT at all. Before
 *   this, picking a country was enough to assess the standard rate on every
 *   categorised row — so a household that only said where it lives got "input
 *   VAT" on its groceries. Home workspaces start as `not_registered`, and so
 *   do workspaces whose latest income-tax profile marks them a German
 *   Kleinunternehmer (`small_business`). Everyone else keeps today's
 *   behaviour (`registered`).
 * - Assessments that no longer apply are cleared on rows that are not part of
 *   a filed return. Locked rows keep their figures: those were submitted.
 * - `categories.tax_relevant` and `transactions.tax_relevant`: the
 *   "deductible / keep for the tax return" mark. NULL on a transaction means
 *   "as its category says".
 * - `payees.country_code` and `payees.vat_id`: what decides whether a
 *   cross-border purchase is reverse-charged, kept where the user already
 *   names the other party.
 */
export class AddVatStatusAndTaxRelevance1787100000000 implements MigrationInterface {
  name = 'AddVatStatusAndTaxRelevance1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces"
        ADD COLUMN IF NOT EXISTS "vat_status" varchar(20) NOT NULL DEFAULT 'registered'
    `);
    await queryRunner.query(`
      UPDATE "workspaces" SET "vat_status" = 'not_registered'
      WHERE "settings"->>'profile' = 'home'
    `);
    await queryRunner.query(`
      UPDATE "workspaces" w SET "vat_status" = 'small_business'
      FROM (
        SELECT DISTINCT ON ("workspace_id") "workspace_id", "details"
        FROM "income_tax_profiles"
        ORDER BY "workspace_id", "tax_year" DESC
      ) latest
      WHERE latest."workspace_id" = w."id"
        AND w."vat_status" = 'registered'
        AND latest."details"->>'smallBusiness' = 'true'
    `);
    await queryRunner.query(`
      UPDATE "transactions" t SET
        "tax_rate_id" = NULL,
        "tax_rule_id" = NULL,
        "tax_source" = NULL,
        "tax_amount" = NULL,
        "tax_net_amount" = NULL,
        "tax_notional_amount" = NULL,
        "tax_reverse_charge" = false
      FROM "workspaces" w
      WHERE w."id" = t."workspace_id"
        AND w."vat_status" <> 'registered'
        AND t."tax_locked" = false
        AND (t."tax_amount" IS NOT NULL OR t."tax_rate_id" IS NOT NULL)
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD COLUMN IF NOT EXISTS "tax_relevant" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "tax_relevant" boolean
    `);

    await queryRunner.query(`
      ALTER TABLE "payees"
        ADD COLUMN IF NOT EXISTS "country_code" varchar(2),
        ADD COLUMN IF NOT EXISTS "vat_id" varchar(32)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payees" DROP COLUMN IF EXISTS "vat_id", DROP COLUMN IF EXISTS "country_code"
    `);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "tax_relevant"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "tax_relevant"`);
    // The cleared assessments are not restored: re-applying the tax rules
    // after switching a workspace back to `registered` rebuilds them.
    await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "vat_status"`);
  }
}
