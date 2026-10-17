import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dated snapshots of a workspace, kept on the server so the app can be opened
 * as it was on a past day. A row is one version; its rows and documents live
 * in the version store, addressed by hash (`payload_blob`, `file_refs`).
 * Only a new table — no existing row changes.
 */
export class CreateWorkspaceVersions1787250000000 implements MigrationInterface {
  name = 'CreateWorkspaceVersions1787250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "workspace_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "taken_at" timestamptz NOT NULL DEFAULT now(),
        "trigger" varchar(16) NOT NULL,
        "status" varchar(16) NOT NULL,
        "scheduled_for" date,
        "payload_sha256" varchar(64),
        "payload_blob" varchar(64),
        "wrapped_data_key" text,
        "format_version" integer NOT NULL DEFAULT 1,
        "size_bytes" bigint NOT NULL DEFAULT 0,
        "row_counts" jsonb NOT NULL DEFAULT '{}',
        "file_refs" text[] NOT NULL DEFAULT '{}',
        "error_message" text,
        "created_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_versions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_workspace_versions_trigger" CHECK ("trigger" IN ('manual', 'scheduled')),
        CONSTRAINT "CHK_workspace_versions_status" CHECK ("status" IN ('running', 'ready', 'failed')),
        CONSTRAINT "FK_workspace_versions_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_workspace_versions_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_workspace_versions_workspace_taken" ON "workspace_versions" ("workspace_id", "taken_at" DESC)`,
    );
    // One nightly version per workspace and day, however many servers run the job.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workspace_versions_scheduled_day" ON "workspace_versions" ("workspace_id", "scheduled_for") WHERE "trigger" = 'scheduled'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "workspace_versions"`);
  }
}
