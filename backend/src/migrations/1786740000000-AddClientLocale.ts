import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The language a client's documents are written in.
 *
 * The invoice PDF used to be hardcoded English in a product that ships 36
 * locales; now it follows the client, because the client is who reads it.
 * NULL falls back to English.
 */
export class AddClientLocale1786740000000 implements MigrationInterface {
  name = 'AddClientLocale1786740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "locale" character varying(10)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN IF EXISTS "locale"`);
  }
}
