import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A subscription payment can be recorded by hand (a date and an amount) before
 * its bank row arrives, so the charge no longer needs a transaction. The unique
 * constraint and the cascading foreign key stay: a bank row is at most one
 * payment, and deleting the row still deletes the payment linked to it.
 */
export class NullableSubscriptionChargeTransaction1787350000000 implements MigrationInterface {
  name = 'NullableSubscriptionChargeTransaction1787350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_charges" ALTER COLUMN "transaction_id" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Payments recorded by hand have nothing to point at once the column is required.
    await queryRunner.query(`DELETE FROM "subscription_charges" WHERE "transaction_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "subscription_charges" ALTER COLUMN "transaction_id" SET NOT NULL`,
    );
  }
}
