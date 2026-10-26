import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The credit cards and loans on the Accounts page owe money; net worth and the
 * balance sheet show it on a line of its own under borrowed capital, kept up
 * from the accounts' rows like cash is. New workspaces get it from the default
 * chart; this adds it to the ones seeded before.
 */
export class AddAccountDebtsBalanceLine1787430000000 implements MigrationInterface {
  name = 'AddAccountDebtsBalanceLine1787430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "balance_accounts" (
        "workspace_id", "parent_id", "code", "name", "name_en", "name_kk",
        "account_type", "sub_type", "is_editable", "is_auto_computed", "auto_source",
        "position", "is_system", "is_expandable"
      )
      SELECT parent."workspace_id", parent."id", 'LIABILITY_ACCOUNT_DEBTS',
        'Кредитные карты и кредиты', 'Cards and loans', 'Несие карталары мен несиелер',
        'liability', 'borrowed_capital', false, true, 'wallets',
        0, true, false
      FROM "balance_accounts" parent
      WHERE parent."code" = 'LIABILITY_BORROWED'
      ON CONFLICT ("workspace_id", "code") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "balance_accounts" WHERE "code" = 'LIABILITY_ACCOUNT_DEBTS'
    `);
  }
}
