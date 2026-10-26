import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReceiptPlaceLocationSource1786900000000 implements MigrationInterface {
  name = 'AddReceiptPlaceLocationSource1786900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // place — магазин, который пользователь выбрал из списка мест рядом, когда
    // GPS вернулся после съёмки. Название и OSM-id лежат в metadata.place.
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT IF EXISTS "CHK_receipts_location_source"`,
    );
    await queryRunner.query(`
      ALTER TABLE "receipts" ADD CONSTRAINT "CHK_receipts_location_source" CHECK (
        "location_source" IS NULL
        OR "location_source" IN ('merchant_address', 'exif', 'device', 'manual', 'fiscal_qr', 'place')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Выбранное место — тоже точка пользователя, поэтому без потерь становится ручной.
    await queryRunner.query(
      `UPDATE "receipts" SET "location_source" = 'manual' WHERE "location_source" = 'place'`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT IF EXISTS "CHK_receipts_location_source"`,
    );
    await queryRunner.query(`
      ALTER TABLE "receipts" ADD CONSTRAINT "CHK_receipts_location_source" CHECK (
        "location_source" IS NULL
        OR "location_source" IN ('merchant_address', 'exif', 'device', 'manual', 'fiscal_qr')
      )
    `);
  }
}
