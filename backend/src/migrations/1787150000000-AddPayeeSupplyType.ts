import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Whether a payee supplies goods or services. A cross-border reverse charge
 * goes on different lines of the German VAT return for each, and nothing else
 * in the data tells them apart. Adds one nullable column; no row changes.
 */
export class AddPayeeSupplyType1787150000000 implements MigrationInterface {
  name = 'AddPayeeSupplyType1787150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payees" ADD COLUMN "supply_type" varchar(16)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payees" DROP COLUMN "supply_type"`);
  }
}
