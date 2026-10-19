import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReceiptLocation1786340000000 implements MigrationInterface {
  name = 'AddReceiptLocation1786340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Итоговая точка чека. Сырые координаты съёмки (EXIF / GPS устройства) лежат
    // в metadata.captureLocation, чтобы «сбросить к авто» можно было пересчитать
    // без исходного запроса загрузки. double precision, а не numeric: pg-драйвер
    // отдаёт numeric строкой.
    await queryRunner.query(`
      ALTER TABLE "receipts"
        ADD COLUMN IF NOT EXISTS "location_lat" double precision,
        ADD COLUMN IF NOT EXISTS "location_lng" double precision,
        ADD COLUMN IF NOT EXISTS "location_source" character varying(32),
        ADD COLUMN IF NOT EXISTS "location_accuracy_m" integer,
        ADD COLUMN IF NOT EXISTS "location_updated_at" TIMESTAMP WITH TIME ZONE
    `);

    // varchar + CHECK вместо pg enum: новое значение источника — одна строка в
    // следующей миграции. fiscal_qr зарезервирован под интеграцию с налоговой.
    await queryRunner.query(`
      ALTER TABLE "receipts" ADD CONSTRAINT "CHK_receipts_location_source" CHECK (
        "location_source" IS NULL
        OR "location_source" IN ('merchant_address', 'exif', 'device', 'manual', 'fiscal_qr')
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "receipts" ADD CONSTRAINT "CHK_receipts_location_range" CHECK (
        "location_lat" IS NULL
        OR ("location_lat" BETWEEN -90 AND 90 AND "location_lng" BETWEEN -180 AND 180)
      )
    `);
    // Точка без источника (или наоборот) — всегда ошибка записи.
    await queryRunner.query(`
      ALTER TABLE "receipts" ADD CONSTRAINT "CHK_receipts_location_pair" CHECK (
        ("location_lat" IS NULL) = ("location_lng" IS NULL)
        AND ("location_lat" IS NULL) = ("location_source" IS NULL)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "map_style_preference" character varying(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "map_style_preference"`);
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT IF EXISTS "CHK_receipts_location_pair"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT IF EXISTS "CHK_receipts_location_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipts" DROP CONSTRAINT IF EXISTS "CHK_receipts_location_source"`,
    );
    await queryRunner.query(`
      ALTER TABLE "receipts"
        DROP COLUMN IF EXISTS "location_updated_at",
        DROP COLUMN IF EXISTS "location_accuracy_m",
        DROP COLUMN IF EXISTS "location_source",
        DROP COLUMN IF EXISTS "location_lng",
        DROP COLUMN IF EXISTS "location_lat"
    `);
  }
}
