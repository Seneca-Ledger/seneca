import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The AI chat and every connection to an external language model are gone.
 * Drops their tables (chats and their messages, transaction embeddings, the
 * members' own provider keys) and the workspace-wide provider settings
 * (`workspace_service_settings` rows keyed 'ai', which hold encrypted API keys).
 *
 * Data loss is intended and cannot be undone: down() recreates the tables
 * empty, in the shape the earlier migrations left them, so older migrations
 * can roll back past this one. Chats, embeddings and stored keys do not come
 * back; take a database backup first if they are needed.
 */
export class DropExternalAiData1787270000000 implements MigrationInterface {
  name = 'DropExternalAiData1787270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "workspace_service_settings" WHERE "key" = 'ai'`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_ai_settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transaction_embeddings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_chat_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_chats"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_chat_role_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "ai_chat_role_enum" AS ENUM ('user', 'assistant', 'tool')
    `);
    await queryRunner.query(`
      CREATE TABLE "ai_chats" (
        "id"            uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id"  uuid         NOT NULL,
        "created_by_id" uuid,
        "title"         varchar(255) NOT NULL,
        "model_id"      varchar(128) NOT NULL,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "deleted_at"    TIMESTAMPTZ,
        CONSTRAINT "PK_ai_chats" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_chats_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ai_chats_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_chats_workspace_updated"
        ON "ai_chats" ("workspace_id", "updated_at")
    `);
    await queryRunner.query(`
      CREATE TABLE "ai_chat_messages" (
        "id"             uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "chat_id"        uuid              NOT NULL,
        "workspace_id"   uuid              NOT NULL,
        "role"           ai_chat_role_enum NOT NULL,
        "content"        text              NOT NULL,
        "action_payload" jsonb,
        "created_at"     TIMESTAMPTZ       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_chat_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_chat_messages_chat" FOREIGN KEY ("chat_id")
          REFERENCES "ai_chats"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ai_chat_messages_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_chat_messages_chat_created"
        ON "ai_chat_messages" ("chat_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE TABLE "transaction_embeddings" (
        "id"             uuid         NOT NULL DEFAULT uuid_generate_v4(),
        "transaction_id" uuid         NOT NULL,
        "workspace_id"   uuid         NOT NULL,
        "vector"         real[]       NOT NULL,
        "model_id"       varchar(128) NOT NULL,
        "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transaction_embeddings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_transaction_embeddings_transaction" UNIQUE ("transaction_id"),
        CONSTRAINT "FK_transaction_embeddings_transaction" FOREIGN KEY ("transaction_id")
          REFERENCES "transactions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transaction_embeddings_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transaction_embeddings_workspace"
        ON "transaction_embeddings" ("workspace_id")
    `);
    await queryRunner.query(`
      CREATE TABLE "user_ai_settings" (
        "id"                uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"           uuid        NOT NULL,
        "workspace_id"      uuid        NOT NULL,
        "config"            jsonb       NOT NULL DEFAULT '{}'::jsonb,
        "encrypted_secrets" jsonb       NOT NULL DEFAULT '{}'::jsonb,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_ai_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_ai_settings_user_workspace" UNIQUE ("user_id", "workspace_id"),
        CONSTRAINT "FK_user_ai_settings_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_ai_settings_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE
      )
    `);
  }
}
