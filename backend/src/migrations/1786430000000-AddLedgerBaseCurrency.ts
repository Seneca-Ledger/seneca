import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The currency a workspace's ledger balances in. NULL means the ledger is off
 * for that workspace — 17 of 21 dev workspaces have no `currency` at all, and
 * their transactions span several currencies, so the base is chosen explicitly
 * when the ledger is switched on rather than guessed here.
 */
export class AddLedgerBaseCurrency1786430000000 implements MigrationInterface {
  name = 'AddLedgerBaseCurrency1786430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "ledger_base_currency" character varying(10)
    `);
    await queryRunner.query(`
      ALTER TABLE "workspaces" DROP CONSTRAINT IF EXISTS "CHK_workspaces_ledger_base_currency"
    `);
    await queryRunner.query(`
      ALTER TABLE "workspaces" ADD CONSTRAINT "CHK_workspaces_ledger_base_currency"
        CHECK ("ledger_base_currency" IS NULL OR "ledger_base_currency" ~ '^[A-Z]{3}$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP CONSTRAINT IF EXISTS "CHK_workspaces_ledger_base_currency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "ledger_base_currency"`,
    );
  }
}
