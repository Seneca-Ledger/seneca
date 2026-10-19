import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 of the tax jurisdiction engine: what reverse charge needs to know.
 *
 * Deciding that a supply is reverse-charged takes two facts about the other
 * party — where they are, and whether they are VAT-registered. Neither was
 * recorded, which is why the flag existed but never fired.
 *
 * `tax_notional_amount` is the tax that would have been charged. A
 * reverse-charge return reports it on both sides so the entries cancel, and it
 * cannot be recomputed later from a rate that may since have been corrected.
 */
export class AddCounterpartyTaxFields1786110000000 implements MigrationInterface {
  name = 'AddCounterpartyTaxFields1786110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN IF NOT EXISTS "counterparty_country" character varying(2),
        ADD COLUMN IF NOT EXISTS "counterparty_vat_id"  character varying(32),
        ADD COLUMN IF NOT EXISTS "tax_notional_amount"  numeric(15,2)
    `);

    // A country code that is not a country would silently never match a
    // jurisdiction, and the supply would quietly be taxed the ordinary way.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "transactions"
          ADD CONSTRAINT "CHK_transactions_counterparty_country"
          CHECK ("counterparty_country" IS NULL OR "counterparty_country" ~ '^[A-Z]{2}$');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_counterparty_country"`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
        DROP COLUMN IF EXISTS "tax_notional_amount",
        DROP COLUMN IF EXISTS "counterparty_vat_id",
        DROP COLUMN IF EXISTS "counterparty_country"
    `);
  }
}
