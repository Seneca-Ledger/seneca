import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResetTokens1786320000000 implements MigrationInterface {
  name = 'CreatePasswordResetTokens1786320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id"         uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"    uuid        NOT NULL,
        "token_hash" varchar(128) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at"    TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_password_reset_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Unique on the hash: lookup happens by hash, and a collision would mean
    // one token could resolve to two users.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_password_reset_tokens_token_hash"
        ON "password_reset_tokens" ("token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_password_reset_tokens_user_id"
        ON "password_reset_tokens" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_tokens"`);
  }
}
