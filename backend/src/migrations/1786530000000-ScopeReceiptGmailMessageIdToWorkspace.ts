import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A mailbox imports into the workspace it was connected in, and the same
 * mailbox may be connected in several workspaces, each getting its own copy
 * of a message's receipt. A message id is therefore unique per workspace,
 * not across the whole table.
 *
 * `down` restores the global index and fails once a message has been
 * imported into two workspaces; remove those copies first.
 */
export class ScopeReceiptGmailMessageIdToWorkspace1786530000000 implements MigrationInterface {
  name = 'ScopeReceiptGmailMessageIdToWorkspace1786530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_receipts_workspace_gmail_message_id_unique"
      ON "receipts" ("workspace_id", "gmail_message_id")
      WHERE "gmail_message_id" IS NOT NULL
    `);
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_receipts_gmail_message_id_unique_not_null"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_receipts_gmail_message_id_unique_not_null"
      ON "receipts" ("gmail_message_id")
      WHERE "gmail_message_id" IS NOT NULL
    `);
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_receipts_workspace_gmail_message_id_unique"',
    );
  }
}
