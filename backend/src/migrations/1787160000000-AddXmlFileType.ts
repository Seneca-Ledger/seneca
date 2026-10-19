import type { MigrationInterface, QueryRunner } from 'typeorm';

/** A statement made from an e-invoice uploaded as the XML itself (XRechnung). */
export class AddXmlFileType1787160000000 implements MigrationInterface {
  name = 'AddXmlFileType1787160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "file_type_enum" ADD VALUE IF NOT EXISTS 'xml'`);
  }

  public async down(): Promise<void> {
    // Enum values cannot be removed in place; it stays, unused.
  }
}
