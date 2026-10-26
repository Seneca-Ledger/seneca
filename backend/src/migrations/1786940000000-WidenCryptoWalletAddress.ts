import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes room for the addresses the multi-chain sync already produces.
 *
 * The column was sized for an EVM address (42 characters) and has been too narrow
 * ever since Bitcoin and Solana were added: a Solana key is 44 and a long bech32
 * address is 62. A Bitcoin extended public key — one key standing for every
 * address a wallet uses — is 111, which is what sets the new width.
 */
export class WidenCryptoWalletAddress1786940000000 implements MigrationInterface {
  name = 'WidenCryptoWalletAddress1786940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "crypto_wallets" ALTER COLUMN "address" TYPE varchar(120)`,
    );
  }

  /**
   * Narrowing back would cut off the addresses this made storable, so rows longer
   * than the old limit are dropped with the wallets they belong to.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "crypto_wallets" WHERE length("address") > 42`);
    await queryRunner.query(`ALTER TABLE "crypto_wallets" ALTER COLUMN "address" TYPE varchar(42)`);
  }
}
