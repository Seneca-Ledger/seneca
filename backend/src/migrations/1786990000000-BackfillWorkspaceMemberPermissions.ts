import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes the member toggles explicit before the authz table starts reading a
 * missing toggle as "no".
 *
 * Until now `workspace_members.permissions` was read as default-allow: a NULL
 * column, or a key left out of it, meant the member could edit. From now on only
 * `true` grants anything, so every right a member has today has to be written
 * down or it disappears at deploy time.
 *
 * What today's members can actually do, and therefore what gets written:
 *   canEditStatements   — yes (statements, transactions)
 *   canEditCustomTables — yes
 *   canEditDataEntry    — yes (the data-entry module and its imports)
 *   canShareFiles       — yes
 *   canEditCategories   — NO. The guard blocked category writes for members
 *                         regardless of this toggle, so granting it here would
 *                         hand out a right nobody has. It stays out unless the
 *                         invitation explicitly set it, in which case the owner
 *                         asked for it and now finally gets it.
 *
 * Owners, admins and viewers keep NULL: for them the column is never read.
 */
export class BackfillWorkspaceMemberPermissions1786990000000 implements MigrationInterface {
  name = 'BackfillWorkspaceMemberPermissions1786990000000';

  private static readonly CURRENT_RIGHTS = `'{
    "canEditStatements": true,
    "canEditCustomTables": true,
    "canEditDataEntry": true,
    "canShareFiles": true
  }'::jsonb`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rights = BackfillWorkspaceMemberPermissions1786990000000.CURRENT_RIGHTS;

    // Members with no column at all: write down what they can do today.
    await queryRunner.query(`
      UPDATE workspace_members
      SET permissions = ${rights}
      WHERE role = 'member' AND permissions IS NULL
    `);

    // Members with a partial column: fill the gaps, keeping every value the
    // owner set — including an explicit false — because ours is the left operand.
    await queryRunner.query(`
      UPDATE workspace_members
      SET permissions = ${rights} || permissions
      WHERE role = 'member' AND permissions IS NOT NULL
    `);

    // Pending invitations carry the same column into the membership they create.
    await queryRunner.query(`
      UPDATE workspace_invitations
      SET permissions = ${rights}
      WHERE role = 'member' AND status = 'pending' AND permissions IS NULL
    `);
    await queryRunner.query(`
      UPDATE workspace_invitations
      SET permissions = ${rights} || permissions
      WHERE role = 'member' AND status = 'pending' AND permissions IS NOT NULL
    `);

    // Roles that never read the column should not carry stale values.
    await queryRunner.query(`
      UPDATE workspace_members
      SET permissions = NULL
      WHERE role <> 'member' AND permissions IS NOT NULL
    `);
  }

  /**
   * Rolling back restores the default-allow reading, where NULL means "may
   * edit" — which is what the code being rolled back to expects. Toggles an
   * owner had switched off are lost, so a deliberate deny has to be set again.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE workspace_members
      SET permissions = NULL
      WHERE role = 'member'
    `);
    await queryRunner.query(`
      UPDATE workspace_invitations
      SET permissions = NULL
      WHERE role = 'member' AND status = 'pending'
    `);
  }
}
