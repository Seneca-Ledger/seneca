import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives a wallet and a transaction a person: who in the household it belongs to.
 *
 * NULL is "shared", and every existing row starts there — the same default
 * Monarch uses when it turns Shared Views on, because a workspace that has only
 * ever had one person in it has nothing to split.
 *
 * The reference is to `workspace_members`, not `users`: ownership belongs to a
 * membership in this workspace, so it cannot point at someone who was never
 * invited here. ON DELETE SET NULL means removing a member turns their rows
 * into shared ones rather than deleting the money.
 */
export class AddTransactionOwnerMember1787000000000 implements MigrationInterface {
  name = 'AddTransactionOwnerMember1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wallets
      ADD COLUMN IF NOT EXISTS owner_member_id uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE wallets
      ADD CONSTRAINT "FK_wallets_owner_member"
      FOREIGN KEY (owner_member_id) REFERENCES workspace_members(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS owner_member_id uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE transactions
      ADD CONSTRAINT "FK_transactions_owner_member"
      FOREIGN KEY (owner_member_id) REFERENCES workspace_members(id) ON DELETE SET NULL
    `);

    // Every owner filter runs inside one workspace, and "shared" is the common
    // case, so the index is partial: it covers the rows an owner filter selects
    // without carrying the NULLs.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_workspace_owner"
      ON transactions (workspace_id, owner_member_id)
      WHERE owner_member_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_workspace_owner"`);
    await queryRunner.query(
      `ALTER TABLE transactions DROP CONSTRAINT IF EXISTS "FK_transactions_owner_member"`,
    );
    await queryRunner.query(`ALTER TABLE transactions DROP COLUMN IF EXISTS owner_member_id`);
    await queryRunner.query(
      `ALTER TABLE wallets DROP CONSTRAINT IF EXISTS "FK_wallets_owner_member"`,
    );
    await queryRunner.query(`ALTER TABLE wallets DROP COLUMN IF EXISTS owner_member_id`);
  }
}
