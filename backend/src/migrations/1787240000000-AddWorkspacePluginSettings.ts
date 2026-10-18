import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plugin switches move from the browser to `workspaces.settings.plugins`.
 *
 * Until now the switch only lived in localStorage and gated nothing, so every
 * workspace that set up webhooks or an API key relied on them working. Those
 * keep working: webhooks are on where the workspace has an inbound endpoint or
 * an outbound subscription, MCP is on where it has a live API key. The AI
 * assistant was open to everyone, so existing workspaces keep it; new ones
 * start with every plugin off.
 */
export class AddWorkspacePluginSettings1787240000000 implements MigrationInterface {
  name = 'AddWorkspacePluginSettings1787240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "workspaces" w
      SET "settings" = COALESCE(w."settings", '{}'::jsonb) || jsonb_build_object(
        'plugins', jsonb_build_object(
          'webhooks',
            EXISTS (SELECT 1 FROM "webhook_endpoints" e WHERE e."workspace_id" = w."id")
            OR EXISTS (SELECT 1 FROM "webhook_subscriptions" s WHERE s."workspace_id" = w."id"),
          'mcp', EXISTS (
            SELECT 1 FROM "api_keys" k
            WHERE k."workspace_id" = w."id"
              AND k."revoked_at" IS NULL
              AND (k."expires_at" IS NULL OR k."expires_at" > now())
          ),
          'aiAssistant', true
        )
      )
      WHERE NOT (COALESCE(w."settings", '{}'::jsonb) ? 'plugins')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "workspaces" SET "settings" = "settings" - 'plugins'
      WHERE "settings" ? 'plugins'
    `);
  }
}
