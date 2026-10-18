import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A workspace is either an ordinary one or a past version opened to look at:
 * a read-only copy of a workspace as it was on a date. Every existing
 * workspace is ordinary. Only a new column with a default — no row changes.
 */
export class AddWorkspaceKind1787240000000 implements MigrationInterface {
  name = 'AddWorkspaceKind1787240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD COLUMN "kind" varchar(16) NOT NULL DEFAULT 'standard'`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD CONSTRAINT "CHK_workspaces_kind" CHECK ("kind" IN ('standard', 'version'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workspaces_version_kind" ON "workspaces" ("id") WHERE "kind" = 'version'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_workspaces_version_kind"`);
    await queryRunner.query(`ALTER TABLE "workspaces" DROP CONSTRAINT "CHK_workspaces_kind"`);
    await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "kind"`);
  }
}
