import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { SUPPORTED_CHAIN_IDS } from '../crypto.constants';

export class ConnectCryptoWalletDto {
  /**
   * A public address — EVM (`0x…`), Tron (`T…`), Bitcoin or Solana — or a Bitcoin
   * extended public key (`xpub…`, 111 characters), which stands for every address
   * that wallet uses. The format is checked in the service, where the network is
   * read off it.
   */
  @IsString()
  @Length(26, 120)
  address: string;

  /** Optional: one network. Read off the address format when both fields are absent. */
  @IsOptional()
  @IsIn(SUPPORTED_CHAIN_IDS)
  chainId?: number;

  /**
   * Optional: several networks for one EVM address, which is the same address on
   * every EVM chain. One wallet is created per chain.
   */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(SUPPORTED_CHAIN_IDS.length)
  @IsIn(SUPPORTED_CHAIN_IDS, { each: true })
  chainIds?: number[];

  @IsOptional()
  @IsString()
  @Length(1, 100)
  label?: string;
}
