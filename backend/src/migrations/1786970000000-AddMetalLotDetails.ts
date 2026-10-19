import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a lot is besides a number: a photo, where it is kept, what it is
 * insured for, and the receipt that proves the purchase. All nullable — a lot
 * entered as "ten coins" stays a valid lot.
 */
export class AddMetalLotDetails1786970000000 implements MigrationInterface {
  name = 'AddMetalLotDetails1786970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "investment_holdings"
        ADD COLUMN IF NOT EXISTS "photo_file" character varying(255),
        ADD COLUMN IF NOT EXISTS "storage_location" character varying(255),
        ADD COLUMN IF NOT EXISTS "insured_value" numeric(20,6),
        ADD COLUMN IF NOT EXISTS "insured_currency" character varying(10),
        ADD COLUMN IF NOT EXISTS "receipt_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "investment_holdings"
        ADD CONSTRAINT "FK_investment_holdings_receipt"
        FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "investment_holdings" DROP CONSTRAINT IF EXISTS "FK_investment_holdings_receipt"`,
    );
    await queryRunner.query(`
      ALTER TABLE "investment_holdings"
        DROP COLUMN IF EXISTS "receipt_id",
        DROP COLUMN IF EXISTS "insured_currency",
        DROP COLUMN IF EXISTS "insured_value",
        DROP COLUMN IF EXISTS "storage_location",
        DROP COLUMN IF EXISTS "photo_file"
    `);
  }
}
