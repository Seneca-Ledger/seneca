import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Peppol through the workspace's own access point account: the connection
 * (key and encrypted secret), each document sent and its delivery, and the
 * documents received. Clients get their Peppol id; a received e-invoice is a
 * receipt with source `peppol`. Only new tables, a nullable column and an enum
 * value — no existing row changes.
 */
export class AddPeppol1787220000000 implements MigrationInterface {
  name = 'AddPeppol1787220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clients" ADD COLUMN "peppol_id" varchar(100)`);
    await queryRunner.query(`ALTER TYPE "receipts_source_enum" ADD VALUE IF NOT EXISTS 'peppol'`);

    await queryRunner.query(`
      CREATE TABLE "peppol_connections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "provider" varchar(20) NOT NULL DEFAULT 'recommand',
        "api_key_id" varchar(200) NOT NULL,
        "api_secret" text NOT NULL,
        "company_id" varchar(100) NOT NULL,
        "company_name" varchar(255),
        "sender_peppol_id" varchar(100) NOT NULL,
        "last_polled_at" timestamptz,
        "last_error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_peppol_connections" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_peppol_connections_workspace" UNIQUE ("workspace_id"),
        CONSTRAINT "FK_peppol_connections_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "peppol_transmissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "invoice_id" uuid,
        "credit_note_id" uuid,
        "recipient" varchar(100) NOT NULL,
        "format" varchar(20) NOT NULL,
        "doc_type_id" text NOT NULL,
        "provider_document_id" varchar(100),
        "document_xml" text NOT NULL,
        "status" varchar(20) NOT NULL,
        "failure" text,
        "sent_by_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_peppol_transmissions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_peppol_transmissions_document"
          CHECK (("invoice_id" IS NULL) <> ("credit_note_id" IS NULL)),
        CONSTRAINT "CHK_peppol_transmissions_status"
          CHECK ("status" IN ('pending', 'delivered', 'failed')),
        CONSTRAINT "FK_peppol_transmissions_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_peppol_transmissions_invoice" FOREIGN KEY ("invoice_id")
          REFERENCES "invoices"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_peppol_transmissions_credit_note" FOREIGN KEY ("credit_note_id")
          REFERENCES "credit_notes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_peppol_transmissions_workspace_status" ON "peppol_transmissions" ("workspace_id", "status")`,
    );
    // One live transmission per document: a failed one may be retried.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_peppol_transmissions_invoice_live" ON "peppol_transmissions" ("invoice_id") WHERE "invoice_id" IS NOT NULL AND "status" <> 'failed'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_peppol_transmissions_credit_note_live" ON "peppol_transmissions" ("credit_note_id") WHERE "credit_note_id" IS NOT NULL AND "status" <> 'failed'`,
    );

    await queryRunner.query(`
      CREATE TABLE "peppol_inbound_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspace_id" uuid NOT NULL,
        "provider_document_id" varchar(100) NOT NULL,
        "sender_peppol_id" varchar(100),
        "receipt_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_peppol_inbound_documents" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_peppol_inbound_documents_workspace_document"
          UNIQUE ("workspace_id", "provider_document_id"),
        CONSTRAINT "FK_peppol_inbound_documents_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_peppol_inbound_documents_receipt" FOREIGN KEY ("receipt_id")
          REFERENCES "receipts"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "peppol_inbound_documents"`);
    await queryRunner.query(`DROP TABLE "peppol_transmissions"`);
    await queryRunner.query(`DROP TABLE "peppol_connections"`);
    await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "peppol_id"`);
    // An enum value cannot be dropped in PostgreSQL; 'peppol' stays in receipts_source_enum.
  }
}
