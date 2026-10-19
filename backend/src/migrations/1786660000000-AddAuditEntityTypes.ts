import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audit coverage for the planning, tax, crypto and security areas. `budget` and
 * `subscription` were already in the TypeScript enum without a database value, so
 * the first event of either kind would have failed on insert.
 */
const VALUES = [
  'budget',
  'subscription',
  'goal',
  'crypto_wallet',
  'tax_rate',
  'tax_rule',
  'tax_return',
  'workspace_member',
  'api_key',
  'webhook',
  'backup',
  'user',
];

export class AddAuditEntityTypes1786660000000 implements MigrationInterface {
  name = 'AddAuditEntityTypes1786660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of VALUES) {
      await queryRunner.query(`ALTER TYPE "entity_type_enum" ADD VALUE IF NOT EXISTS '${value}'`);
    }
  }

  public async down(): Promise<void> {
    // Enum value removal is not supported safely.
  }
}
