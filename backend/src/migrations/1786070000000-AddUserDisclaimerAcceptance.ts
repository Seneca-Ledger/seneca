import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records acceptance of the no-warranty disclaimer shown on first sign-in.
 *
 * Both columns stay NULL for existing accounts: nobody has been shown the text
 * yet, and back-dating consent that was never given would defeat the point of
 * recording it.
 */
export class AddUserDisclaimerAcceptance1786070000000 implements MigrationInterface {
  name = 'AddUserDisclaimerAcceptance1786070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "disclaimer_accepted_at" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "disclaimer_version" character varying(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "disclaimer_version",
        DROP COLUMN IF EXISTS "disclaimer_accepted_at"
    `);
  }
}
