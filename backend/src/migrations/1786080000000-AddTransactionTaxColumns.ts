import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 of the tax jurisdiction engine: where the assessed tax is stored.
 *
 * The figures are stored rather than derived on read. That is a deliberate
 * denormalisation: a return that has been filed must not change because
 * somebody later corrected a rate, so the tax is fixed at the moment it is
 * assessed and `tax_rate_id` pins the exact rate version it came from.
 *
 * Everything stays NULL for existing rows — no transaction has been assessed
 * yet, and inventing figures would be worse than having none.
 *
 * `tax_rule_id` is not here: it references `tax_rules`, which phase 4 creates.
 */
export class AddTransactionTaxColumns1786080000000 implements MigrationInterface {
  name = 'AddTransactionTaxColumns1786080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN IF NOT EXISTS "tax_amount"         numeric(15,2),
        ADD COLUMN IF NOT EXISTS "tax_net_amount"     numeric(15,2),
        ADD COLUMN IF NOT EXISTS "tax_source"         character varying(20),
        ADD COLUMN IF NOT EXISTS "tax_reverse_charge" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "tax_locked"         boolean NOT NULL DEFAULT false
    `);

    // Reporting always slices by workspace and period, and only ever cares
    // about rows that carry tax.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_tax_period"
        ON "transactions" ("workspace_id", "transaction_date")
        WHERE "tax_amount" IS NOT NULL
    `);

    // A locked row belongs to a filed return, so it must carry the figures
    // that return was built from. Locking an unassessed row would silently
    // freeze a gap into the filing.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "transactions"
          ADD CONSTRAINT "CHK_transactions_tax_locked_assessed"
          CHECK ("tax_locked" = false OR "tax_amount" IS NOT NULL);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_tax_locked_assessed"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_tax_period"`);
    await queryRunner.query(`
      ALTER TABLE "transactions"
        DROP COLUMN IF EXISTS "tax_locked",
        DROP COLUMN IF EXISTS "tax_reverse_charge",
        DROP COLUMN IF EXISTS "tax_source",
        DROP COLUMN IF EXISTS "tax_net_amount",
        DROP COLUMN IF EXISTS "tax_amount"
    `);
  }
}
