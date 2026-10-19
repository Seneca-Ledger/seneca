import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Workspace deletion was impossible at the DB level:
 *
 * 1. FK_audit_events_workspace is ON DELETE SET NULL (1760000000000), but
 *    1764200000005 later made audit_events.workspace_id NOT NULL. Deleting any
 *    workspace with audit events (i.e. every workspace) violated NOT NULL.
 *    The column becomes nullable again: the audit trail must survive the
 *    workspace it describes (see .claude/rules/database.md — audit immutability).
 *
 * 2. transactions.category_id / branch_id / wallet_id were created in
 *    1733000000000 with no ON DELETE (NO ACTION), so deleting a category,
 *    branch, or wallet that has transactions failed with a raw FK violation —
 *    and workspace deletion could abort mid-cascade depending on constraint
 *    order. They become ON DELETE SET NULL, matching the nullable columns.
 */
export class FixWorkspaceDeletionConstraints1786240000000 implements MigrationInterface {
  name = 'FixWorkspaceDeletionConstraints1786240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_events" ALTER COLUMN "workspace_id" DROP NOT NULL`);

    // The original FKs were created by TypeORM with generated hash names —
    // find them by column instead of hardcoding.
    await queryRunner.query(`
      DO $$
      DECLARE fk record;
      BEGIN
        FOR fk IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_attribute att
            ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
          WHERE con.conrelid = 'transactions'::regclass
            AND con.contype = 'f'
            AND att.attname IN ('category_id', 'branch_id', 'wallet_id')
        LOOP
          EXECUTE format('ALTER TABLE "transactions" DROP CONSTRAINT %I', fk.conname);
        END LOOP;
      END
      $$
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_category_id"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_branch_id"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_wallet_id"
      FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_wallet_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_branch_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_category_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_category_id"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id")
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_branch_id"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_wallet_id"
      FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id")
    `);
    // Rows detached by workspace deletion would violate NOT NULL — clear them
    // before restoring the constraint.
    await queryRunner.query(`DELETE FROM "audit_events" WHERE "workspace_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "audit_events" ALTER COLUMN "workspace_id" SET NOT NULL`);
  }
}
