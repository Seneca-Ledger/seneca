import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClients1786530000000 implements MigrationInterface {
  name = 'CreateClients1786530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "clients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "email" character varying(255),
        "billing_address" text,
        "tax_id" character varying(64),
        "currency" character varying(3) NOT NULL DEFAULT 'KZT',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_clients" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "clients"
      ADD CONSTRAINT "FK_clients_workspace"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_clients_workspace_name"
      ON "clients" ("workspace_id", "name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_clients_workspace_name"');
    await queryRunner.query('DROP TABLE IF EXISTS "clients"');
  }
}
