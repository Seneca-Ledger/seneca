import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushSubscriptions1786780000000 implements MigrationInterface {
  name = 'AddPushSubscriptions1786780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" character varying(255) NOT NULL,
        "auth" character varying(255) NOT NULL,
        "user_agent" character varying(255),
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_push_subscriptions_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_push_subscriptions_user" ON "push_subscriptions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_push_subscriptions_endpoint" ON "push_subscriptions" ("endpoint")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "push_subscriptions"`);
  }
}
