import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The payees whose new rows become payments of a subscription on their own:
 * the payee of each bank row a person linked to it. A new table only, no data.
 */
export class SubscriptionPayees1787360000000 implements MigrationInterface {
  name = 'SubscriptionPayees1787360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscription_payees" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "subscription_id" uuid NOT NULL,
        "payee_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_payees" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_subscription_payees_subscription_payee" UNIQUE ("subscription_id", "payee_id"),
        CONSTRAINT "FK_subscription_payees_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_subscription_payees_subscription" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_subscription_payees_payee" FOREIGN KEY ("payee_id") REFERENCES "payees"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_subscription_payees_workspace_payee" ON "subscription_payees" ("workspace_id", "payee_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "subscription_payees"`);
  }
}
