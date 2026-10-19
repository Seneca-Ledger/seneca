import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 of the tax jurisdiction engine: category-to-rate rules, plus the
 * provenance column that records which rule produced a figure.
 *
 * Rules store a rate `code`, not a rate id. A code spans every version of a
 * rate, so a rule written today keeps working after the law changes —
 * assignment resolves the code against the transaction's own date.
 */
export class CreateTaxRules1786090000000 implements MigrationInterface {
  name = 'CreateTaxRules1786090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tax_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "category_id" uuid,
        "tax_rate_code" character varying(40) NOT NULL,
        "priority" integer NOT NULL DEFAULT 0,
        "direction" character varying(20) NOT NULL DEFAULT 'both',
        "is_enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tax_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tax_rules_workspace"
          FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tax_rules_category"
          FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE
      )
    `);

    // Assignment loads a workspace's enabled rules on every resolution.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tax_rules_workspace_enabled"
        ON "tax_rules" ("workspace_id", "is_enabled")
    `);

    // One rule per category and direction, so resolution cannot depend on
    // which of two identical rules the database happened to return first.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tax_rules_category_direction"
        ON "tax_rules" ("workspace_id", "category_id", "direction")
        WHERE "category_id" IS NOT NULL
    `);

    // The catch-all equivalent: at most one rule without a category per
    // direction.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tax_rules_catchall_direction"
        ON "tax_rules" ("workspace_id", "direction")
        WHERE "category_id" IS NULL
    `);

    // Provenance: which rule produced the figures on this transaction. Kept so
    // an unexpected amount can be traced to the rule that caused it.
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN IF NOT EXISTS "tax_rule_id" uuid
    `);

    // SET NULL rather than CASCADE: deleting a rule must not delete the
    // transactions it once touched, and their assessed tax stays valid.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "transactions"
          ADD CONSTRAINT "FK_transactions_tax_rule"
          FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_tax_rule"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN IF EXISTS "tax_rule_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_rules"`);
  }
}
