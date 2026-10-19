import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceAndClientToAuditEntityTypeEnum1786580000000 implements MigrationInterface {
  name = 'AddInvoiceAndClientToAuditEntityTypeEnum1786580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "entity_type_enum" ADD VALUE IF NOT EXISTS 'invoice'`);
    await queryRunner.query(`ALTER TYPE "entity_type_enum" ADD VALUE IF NOT EXISTS 'client'`);
  }

  public async down(): Promise<void> {
    // Enum value removal is not supported safely.
  }
}
