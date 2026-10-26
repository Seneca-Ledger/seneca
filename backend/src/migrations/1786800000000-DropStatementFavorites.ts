import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The search panel that owned personal statement stars is gone, replaced by the
 * command palette. Indexes and both foreign keys go with the table.
 */
export class DropStatementFavorites1786800000000 implements MigrationInterface {
  name = 'DropStatementFavorites1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "statement_favorites"`);
  }

  /** The original CREATE, so a revert leaves the schema exactly as it was. */
  public async down(queryRunner: QueryRunner): Promise<void> {
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
}
