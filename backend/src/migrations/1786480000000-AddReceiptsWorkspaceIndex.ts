import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Receipt lists are scoped by workspace, newest first. The Gmail list behind
 * the statements page is polled every few seconds and used to filter by user,
 * which had an index; the workspace filter that replaces it had none.
 */
export class AddReceiptsWorkspaceIndex1786480000000 implements MigrationInterface {
  name = 'AddReceiptsWorkspaceIndex1786480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_receipts_workspace_received_at" ON "receipts" ("workspace_id", "received_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_receipts_workspace_received_at"');
  }
}
