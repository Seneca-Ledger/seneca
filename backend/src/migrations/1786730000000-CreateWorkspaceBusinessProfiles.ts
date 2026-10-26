import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The issuer's side of an invoice.
 *
 * Until now the generated PDF carried the client's details and nothing about
 * who sent it — no legal name, no address, no tax id, no bank account — which
 * is not a document a client can pay or an auditor can accept.
 */
export class CreateWorkspaceBusinessProfiles1786730000000 implements MigrationInterface {
  name = 'CreateWorkspaceBusinessProfiles1786730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_business_profiles" (
        "workspace_id"         uuid PRIMARY KEY REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "legal_name"           character varying(255),
        "registration_id"      character varying(64),
        "tax_id"               character varying(64),
        "address_lines"        text,
        "country_code"         character varying(2),
        "email"                character varying(255),
        "phone"                character varying(64),
        "website"              character varying(255),
        "bank_name"            character varying(255),
        "bank_account"         character varying(64),
        "bank_code"            character varying(32),
        "payment_instructions" text,
        "invoice_footer"       text,
        "logo_file"            character varying(255),
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "updated_at"           timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_business_profiles"`);
  }
}
