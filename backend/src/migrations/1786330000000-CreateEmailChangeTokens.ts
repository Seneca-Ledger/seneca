import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailChangeTokens1786330000000 implements MigrationInterface {
  name = 'CreateEmailChangeTokens1786330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_change_tokens" (
        "id"         uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"    uuid         NOT NULL,
        "new_email"  varchar(320) NOT NULL,
        "token_hash" varchar(128) NOT NULL,
        "expires_at" TIMESTAMPTZ  NOT NULL,
        "used_at"    TIMESTAMPTZ  NULL,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_change_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_email_change_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_email_change_tokens_token_hash"
        ON "email_change_tokens" ("token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_email_change_tokens_user_id"
        ON "email_change_tokens" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "email_change_tokens"`);
  }
}
