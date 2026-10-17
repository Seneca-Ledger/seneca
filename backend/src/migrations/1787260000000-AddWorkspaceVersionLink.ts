import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A past version opened to look at is a workspace of its own; it names the
 * version it was opened from. Deleting the version (retention) deletes the
 * opened copy with it. Only a new nullable column — no existing row changes.
 */
export class AddWorkspaceVersionLink1787260000000 implements MigrationInterface {
  name = 'AddWorkspaceVersionLink1787260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workspaces" ADD COLUMN "version_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD CONSTRAINT "FK_workspaces_version" FOREIGN KEY ("version_id") REFERENCES "workspace_versions"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workspaces_version_id" ON "workspaces" ("version_id") WHERE "version_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "version_id"`);
  }
}
