import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A log of every attempt to send an invoice to its client.
 *
 * Until now "sent" only meant a number had been assigned: nothing left the
 * server, and nothing recorded whether it had. The failures are kept too —
 * silent non-delivery is the whole problem being solved.
 */
export class CreateInvoiceDeliveries1786750000000 implements MigrationInterface {
  name = 'CreateInvoiceDeliveries1786750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice_deliveries" (
        "id"           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "invoice_id"   uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
        "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "sent_by_id"   uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "channel"      character varying(16) NOT NULL DEFAULT 'email',
        "recipient"    character varying(255) NOT NULL,
        "status"       character varying(16) NOT NULL,
        "subject"      character varying(500),
        "error"        text,
        "created_at"   timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_invoice_deliveries_invoice"
         ON "invoice_deliveries" ("invoice_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_deliveries"`);
  }
}
