import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Personal favourites for the search panel: one row per user and starred
 * statement. The index on statement_id keeps the cascade cheap when a
 * statement is deleted for good.
 */
export class CreateStatementFavorites1786520000000 implements MigrationInterface {
  name = 'CreateStatementFavorites1786520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "statement_favorites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "statement_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_statement_favorites" PRIMARY KEY ("id"),
        CONSTRAINT "FK_statement_favorites_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_statement_favorites_statement"
          FOREIGN KEY ("statement_id") REFERENCES "statements"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_statement_favorites_user_statement"
        ON "statement_favorites" ("user_id", "statement_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_statement_favorites_statement"
        ON "statement_favorites" ("statement_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "statement_favorites"`);
  }
}
