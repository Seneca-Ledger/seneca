import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * People without an uploaded photo were given a DiceBear identicon URL on
 * sign-in. The app now draws their initial itself, so those URLs go; uploaded
 * photos are left alone. The identicons are not brought back on down.
 */
export class DropIdenticonAvatars1787380000000 implements MigrationInterface {
  name = 'DropIdenticonAvatars1787380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "avatar_url" = NULL WHERE "avatar_url" LIKE 'https://api.dicebear.com/%'`,
    );
  }

  public async down(): Promise<void> {}
}
