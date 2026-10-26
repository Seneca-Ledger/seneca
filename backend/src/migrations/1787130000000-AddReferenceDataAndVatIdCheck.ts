import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A cache for public reference data (holidays, EU VAT rates) fetched from
 * outside, and the result of checking a payee's VAT number in VIES. Only
 * adds a table and nullable columns; no existing row changes.
 */
export class AddReferenceDataAndVatIdCheck1787130000000 implements MigrationInterface {
  name = 'AddReferenceDataAndVatIdCheck1787130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reference_data" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source" varchar(40) NOT NULL,
        "key" varchar(80) NOT NULL,
        "payload" jsonb NOT NULL,
        "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_reference_data" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_reference_data_source_key" ON "reference_data" ("source", "key")`,
    );
    await queryRunner.query(`
      ALTER TABLE "payees"
        ADD COLUMN "vat_id_status" varchar(16),
        ADD COLUMN "vat_id_checked_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "vat_id_name" varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payees"
        DROP COLUMN "vat_id_name",
        DROP COLUMN "vat_id_checked_at",
        DROP COLUMN "vat_id_status"
    `);
    await queryRunner.query(`DROP INDEX "IDX_reference_data_source_key"`);
    await queryRunner.query(`DROP TABLE "reference_data"`);
  }
}
