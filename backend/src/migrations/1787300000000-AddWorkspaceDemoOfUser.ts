import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marks the demo workspace a user asked for (`POST /workspaces/demo`) with the
 * user it was made for. A user id rather than a flag: ownership can be handed
 * over, the person the sample was made for cannot, and the partial unique
 * index on it is what keeps it to one demo per user even when two requests
 * race (the loser hits 23505 and answers the winner's workspace).
 *
 * ON DELETE SET NULL, as for `owner_id`: a removed user's demo stays an
 * ordinary workspace like their others. Not CASCADE: deleting the user would
 * then delete the workspace while SET NULL rewrites its rows' user columns
 * (subscriptions.owner_id) in the same statement, and those rewrites fail on
 * the vanished workspace. Deleting the workspace drops the mark with the row,
 * and the next request makes a fresh demo.
 *
 * Only a new nullable column — no existing row changes.
 */
export class AddWorkspaceDemoOfUser1787300000000 implements MigrationInterface {
  name = 'AddWorkspaceDemoOfUser1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workspaces" ADD COLUMN "demo_of_user_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD CONSTRAINT "FK_workspaces_demo_of_user" FOREIGN KEY ("demo_of_user_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workspaces_demo_of_user" ON "workspaces" ("demo_of_user_id") WHERE "demo_of_user_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_workspaces_demo_of_user"`);
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP CONSTRAINT "FK_workspaces_demo_of_user"`,
    );
    await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "demo_of_user_id"`);
  }
}
