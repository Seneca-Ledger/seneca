import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The vendor's website host, used to fetch a brand icon through the icon proxy.
 * Existing rows stay null and keep showing initials: guessing a domain from a
 * vendor name would write data nobody approved, so the form asks instead.
 */
export class AddSubscriptionVendorDomain1786410000000 implements MigrationInterface {
  name = 'AddSubscriptionVendorDomain1786410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        ADD COLUMN IF NOT EXISTS "vendor_domain" varchar(253) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
        DROP COLUMN IF EXISTS "vendor_domain"
    `);
  }
}
