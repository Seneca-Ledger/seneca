import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Says which way a line price is quoted.
 *
 * Invoicing used to add tax on top of every price regardless of the rate's own
 * `is_inclusive` flag — and every rate adopted from a jurisdiction is
 * inclusive, because every other amount in the system comes from a gross
 * document. Off for existing invoices, so their totals do not move.
 */
export class AddInvoicePricesIncludeTax1786720000000 implements MigrationInterface {
  name = 'AddInvoicePricesIncludeTax1786720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices"
         ADD COLUMN IF NOT EXISTS "prices_include_tax" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN IF EXISTS "prices_include_tax"`);
  }
}
