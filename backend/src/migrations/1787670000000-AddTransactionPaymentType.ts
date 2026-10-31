import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionPaymentType1787670000000 implements MigrationInterface {
  name = 'AddTransactionPaymentType1787670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "payment_type" text NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "transactions" DROP COLUMN IF EXISTS "payment_type"');
  }
}
