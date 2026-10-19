import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomTableShares1786170000000 implements MigrationInterface {
  name = 'CreateCustomTableShares1786170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_table_shares" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "table_id" uuid NOT NULL,
        "workspace_id" uuid NOT NULL,
        "created_by" uuid,
        "token" character varying(64) NOT NULL,
        "expires_at" TIMESTAMP,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "access_count" integer NOT NULL DEFAULT 0,
        "last_accessed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_custom_table_shares" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_custom_table_shares_token" UNIQUE ("token")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "custom_table_shares"
      ADD CONSTRAINT "FK_custom_table_shares_table"
      FOREIGN KEY ("table_id") REFERENCES "custom_tables"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_table_shares"
      ADD CONSTRAINT "FK_custom_table_shares_workspace"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "custom_table_shares"
      ADD CONSTRAINT "FK_custom_table_shares_user"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(
      'CREATE INDEX "IDX_custom_table_shares_table" ON "custom_table_shares" ("table_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_custom_table_shares_table"');
    await queryRunner.query('DROP TABLE IF EXISTS "custom_table_shares"');
  }
}
