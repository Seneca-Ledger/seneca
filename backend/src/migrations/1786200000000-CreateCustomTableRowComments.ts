import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomTableRowComments1786200000000 implements MigrationInterface {
  name = 'CreateCustomTableRowComments1786200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_table_row_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "row_id" uuid NOT NULL,
        "table_id" uuid NOT NULL,
        "workspace_id" uuid NOT NULL,
        "user_id" uuid,
        "body" text NOT NULL,
        "resolved_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_custom_table_row_comments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_table_row_comments"
      ADD CONSTRAINT "FK_ctrc_row" FOREIGN KEY ("row_id")
      REFERENCES "custom_table_rows"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_table_row_comments"
      ADD CONSTRAINT "FK_ctrc_table" FOREIGN KEY ("table_id")
      REFERENCES "custom_tables"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_table_row_comments"
      ADD CONSTRAINT "FK_ctrc_workspace" FOREIGN KEY ("workspace_id")
      REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_table_row_comments"
      ADD CONSTRAINT "FK_ctrc_user" FOREIGN KEY ("user_id")
      REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_custom_table_row_comments_row" ON "custom_table_row_comments" ("row_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_custom_table_row_comments_row"');
    await queryRunner.query('DROP TABLE IF EXISTS "custom_table_row_comments"');
  }
}
