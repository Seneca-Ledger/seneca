import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCryptoWalletBalances1786290000000 implements MigrationInterface {
  name = 'AddCryptoWalletBalances1786290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Holdings used to be derived from the synced transfers, which made them wrong
    // whenever a single transfer failed to import. They are now read off the chain
    // and cached here; an empty array means "never synced", not "empty wallet".
    await queryRunner.query(`
      ALTER TABLE "crypto_wallets"
        ADD COLUMN IF NOT EXISTS "balances" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "crypto_wallets" DROP COLUMN IF EXISTS "balances"`);
  }
}
